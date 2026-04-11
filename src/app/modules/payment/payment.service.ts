import { StatusCodes } from "http-status-codes";
import {
  decodeNotificationPayload,
  decodeTransaction,
} from "app-store-server-api";
import { Request } from "express";

import { PRODUCT_PLAN_MAP, VALID_PRODUCT_IDS } from "../../config/iap.config";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import Subscription from "../subscription/subscription.model";
import AppError from "../../errorHelpers/AppError";
import { invalidateUserSubscriptionCache } from "../../helpers/redisCache.helper";

// ── main service ─────────────────────────────────────────────────────────────

const verifyPurchase = async (payload: {
  userId: string;
  receiptData: string; // This is now a JWS (signed transaction) from StoreKit 2
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

  // --- 2. Decode & verify the JWS signed transaction ---
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
  // --- 3. Validate the transaction matches the claimed productId ---
  if (transaction.productId !== productId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Product ID mismatch: expected ${productId}, got ${transaction.productId}`
    );
  }

  // --- 4. Check expiry ---
  const expiryMs = transaction.expiresDate;

  if (!expiryMs) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Transaction has no expiry date — not a subscription"
    );
  }

  if (expiryMs < Date.now()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Subscription expired at ${new Date(expiryMs).toISOString()}`
    );
  }

  // --- 5. Resolve internal plan from productId ---
  const resolvedPlan = PRODUCT_PLAN_MAP[productId];

  if (!resolvedPlan) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `No plan mapping found for productId: ${productId}`
    );
  }

  const transactionId = transaction.transactionId;
  const originalTransactionId =
    transaction.originalTransactionId || transactionId;
  const purchaseDate = transaction.purchaseDate
    ? new Date(transaction.purchaseDate)
    : new Date();

  // --- 6. Check for existing active subscription ---
  const existingSub = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.ACTIVE,
  });

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

  // --- 7. Create new subscription ---
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
    auto_renew: true,
  });

  await invalidateUserSubscriptionCache(userId);
  return newSub;
};

// ── webhook handler (unchanged) ──────────────────────────────────────────────

const handleAppleWebhook = async (req: Request) => {
  const signedPayload = req.body.signedPayload;

  if (!signedPayload) {
    throw new Error("No signedPayload received");
  }

  const payload = await decodeNotificationPayload(signedPayload);

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

  if (eventType === "DID_CHANGE_RENEWAL_STATUS") {
    if (transaction.expiresDate) {
      updateData.end_date = new Date(transaction.expiresDate);
    }
  }

  if (eventType === "DID_RENEW") {
    updateData.status = SubscriptionStatus.ACTIVE;
    if (transaction.expiresDate) {
      updateData.end_date = new Date(transaction.expiresDate);
    }
    updateData.transactionId = transactionId;
  }

  if (eventType === "REFUND") {
    updateData.status = SubscriptionStatus.CANCELLED;
  }

  if (Object.keys(updateData).length === 0) {
    return { message: "No action needed for this event type", eventType };
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
    console.log(
      `Webhook updated subscription ${updated._id} for user ${updated.userId}`
    );
    await invalidateUserSubscriptionCache(updated.userId.toString());
  } else {
    console.warn(
      `Webhook received for unknown subscription. transactionId: ${transactionId}, originalTransactionId: ${originalTransactionId}`
    );
  }

  return updated;
};

export const PaymentService = {
  verifyPurchase,
  handleAppleWebhook,
};