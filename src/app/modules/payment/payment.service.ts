import { StatusCodes } from "http-status-codes";
import {
  decodeNotificationPayload,
  decodeTransaction,
} from "app-store-server-api";
import { Request } from "express";

import {
  PRODUCT_PLAN_MAP,
  VALID_PRODUCT_IDS,
} from "../../config/iap.config";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import Subscription from "../subscription/subscription.model";
import AppError from "../../errorHelpers/AppError";
import { invalidateUserSubscriptionCache } from "../../helpers/redisCache.helper";

// ✅ duration config (move to config file if you want cleaner structure)
const PRODUCT_DURATION_MAP: Record<string, number> = {
  mulli_plus_1m: 1,
  mulli_plus_3month: 3,
  mulli_plus_1y: 12,

  mulli_x_1m: 1,
  mulli_x_3m: 3,
  mulli_x_1y: 12,

  mulli_bridie_1m: 1,
  mulli_bridie_3m: 3,
  mulli_bridie_1y: 12,

  mulli_ace_1m: 1,
  mulli_ace_3m: 3,
  mulli_ace_1y: 12,
};

// ── main service ─────────────────────────────────────────────────────────────

const verifyPurchase = async (payload: {
  userId: string;
  receiptData: string;
  productId: string;
  source: "apple" | "google";
}) => {
  const { userId, receiptData, productId, source } = payload;

  // --- 1. Validate productId ---
  if (!VALID_PRODUCT_IDS.includes(productId)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Invalid productId: ${productId}`
    );
  }

  if (source !== "apple") {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only Apple IAP is supported currently"
    );
  }

  // --- 2. Decode transaction ---
  let transaction;
  try {
    transaction = await decodeTransaction(receiptData);
  } catch (err: any) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Failed to decode Apple transaction: ${err.message}`
    );
  }

  console.log("Decoded transaction:", transaction);

  // --- 3. Validate product match ---
  if (transaction.productId !== productId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Product mismatch: expected ${productId}, got ${transaction.productId}`
    );
  }

  // 🚨 4. Prevent duplicate transaction abuse
  const existingTransaction = await Subscription.findOne({
    transactionId: transaction.transactionId,
  });

  if (existingTransaction) {
    return existingTransaction;
  }

  // --- 5. Fetch existing active subscription (once) ---
  const existingSub = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.ACTIVE,
  });

  // --- 6. Handle expiry ---
  let expiryMs = transaction.expiresDate;

  if (!expiryMs) {
    if (transaction.type === "Non-Renewing Subscription") {
      const months = PRODUCT_DURATION_MAP[productId];

      if (!months) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          `No duration mapping for productId: ${productId}`
        );
      }

      if (!transaction.purchaseDate) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "Missing purchaseDate"
        );
      }

      let baseDate = new Date(transaction.purchaseDate);

      // ✅ Extend if still active
      if (existingSub && existingSub.end_date > new Date()) {
        baseDate = existingSub.end_date;
      }

      const expiryDate = new Date(baseDate);
      expiryDate.setMonth(expiryDate.getMonth() + months);

      expiryMs = expiryDate.getTime();
    } else {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Transaction missing expiry date"
      );
    }
  }

  // --- 7. Expiry validation ---
  if (expiryMs < Date.now()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Subscription expired at ${new Date(expiryMs).toISOString()}`
    );
  }

  // --- 8. Resolve plan ---
  const resolvedPlan = PRODUCT_PLAN_MAP[productId];

  if (!resolvedPlan) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `No plan mapping for productId: ${productId}`
    );
  }

  const transactionId = transaction.transactionId;
  const originalTransactionId =
    transaction.originalTransactionId || transactionId;

  const purchaseDate = transaction.purchaseDate
    ? new Date(transaction.purchaseDate)
    : new Date();

  // --- 9. Update or create subscription ---

  if (existingSub) {
    const updated = await Subscription.findByIdAndUpdate(
      existingSub._id,
      {
        plan_type: resolvedPlan,
        transactionId,
        originalTransactionId,
        end_date: new Date(expiryMs),
        status: SubscriptionStatus.ACTIVE,
      },
      { returnDocument: "after" }
    );

    await invalidateUserSubscriptionCache(userId);
    return updated;
  }

  const newSub = await Subscription.create({
    userId,
    plan_type: resolvedPlan,
    status: SubscriptionStatus.ACTIVE,
    transactionId,
    originalTransactionId,
    productId,
    platform: "ios",
    start_date: purchaseDate,
    end_date: new Date(expiryMs),
    auto_renew: false, // ✅ important
  });

  await invalidateUserSubscriptionCache(userId);
  return newSub;
};

// ── webhook handler ──────────────────────────────────────────────────────────

const handleAppleWebhook = async (req: Request) => {
  const signedPayload = req.body.signedPayload;

  if (!signedPayload) {
    throw new Error("No signedPayload received");
  }

  const payload = await decodeNotificationPayload(signedPayload);
  console.log("Decoded Apple webhook payload:", payload);

  if (!payload.data?.signedTransactionInfo) {
    throw new Error("No signedTransactionInfo in payload");
  }

  const transaction = await decodeTransaction(
    payload.data.signedTransactionInfo
  );

  const transactionId = transaction.transactionId;
  const originalTransactionId = transaction.originalTransactionId;
  const eventType = payload.notificationType;

  let updateData: any = {};

  if (eventType === "EXPIRED") {
    updateData.status = SubscriptionStatus.EXPIRED;
    if (transaction.expiresDate) {
      updateData.end_date = new Date(transaction.expiresDate);
    }
  }

  if (eventType === "DID_RENEW") {
    updateData.status = SubscriptionStatus.ACTIVE;
    updateData.transactionId = transactionId;

    if (transaction.expiresDate) {
      updateData.end_date = new Date(transaction.expiresDate);
    }
  }

  if (eventType === "REFUND") {
    updateData.status = SubscriptionStatus.CANCELLED;
  }

  if (Object.keys(updateData).length === 0) {
    return { message: "No action needed", eventType };
  }

  const updated = await Subscription.findOneAndUpdate(
    {
      $or: [
        { transactionId: transactionId },
        { originalTransactionId: originalTransactionId },
      ],
    },
    updateData,
    { returnDocument: "after" }
  );

  if (updated) {
    await invalidateUserSubscriptionCache(updated.userId.toString());
  }

  return updated;
};

export const PaymentService = {
  verifyPurchase,
  handleAppleWebhook,
};