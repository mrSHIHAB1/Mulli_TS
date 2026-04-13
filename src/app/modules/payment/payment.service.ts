import { StatusCodes } from "http-status-codes";
import {
  decodeNotificationPayload,
  decodeRenewalInfo,
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
import PaymentTransaction from "./payment.model";
import {
  PaymentPlatform,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from "./payment.interface";
import { SUBSCRIPTION_PLANS } from "../../config/subscriptionPlans";


// ✅ duration config (move to config file if you want cleaner structure)
const PRODUCT_MONTHS_MAP: Record<string, number> = {
  mulli_eagle_1m: 1,
  mulli_eagle_3m: 3,

  mulli_birdie_1m: 1,
  mulli_birdie_3m: 3,

  mulli_ace_1m: 1,
  mulli_ace_3m: 3,

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

  const transactionId = transaction.transactionId;
  const originalTransactionId =
    transaction.originalTransactionId || transactionId;

  const purchaseDate = transaction.purchaseDate
    ? new Date(transaction.purchaseDate)
    : new Date();

  // --- 5. Resolve existing subscription by originalTransactionId ---
  const existingSub = await Subscription.findOne({
    userId,
    originalTransactionId,
  });


  // --- 6. Handle expiry ---
  let expiryMs = transaction.expiresDate;

  if (!expiryMs) {
    if (transaction.type === "Non-Renewing Subscription") {
      const months = PRODUCT_MONTHS_MAP[productId];


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

      // ✅ Extend if still active (matching this specific product)
      const existingActive = await Subscription.findOne({
        userId,
        productId: transaction.productId,
        status: SubscriptionStatus.ACTIVE,
      });

      if (existingActive && existingActive.end_date > new Date()) {
        baseDate = existingActive.end_date;
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



  // --- 9. Update or create subscription ---

  if (existingSub) {
    const updated = await Subscription.findByIdAndUpdate(
      existingSub._id,
      {
        plan_type: resolvedPlan,
        productId: transaction.productId,
        transactionId,
        originalTransactionId,
        end_date: new Date(expiryMs),
        status: SubscriptionStatus.ACTIVE,
        metadata: transaction,
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
    productId: transaction.productId,
    platform: "ios",
    start_date: purchaseDate,
    end_date: new Date(expiryMs),
    auto_renew: transaction.type === "Auto-Renewable Subscription",
 
  });


  await invalidateUserSubscriptionCache(userId);

  // ── 10. Log Transaction History ───────────────────────────────────────────
  try {
    const planConfig = SUBSCRIPTION_PLANS[resolvedPlan];

    // Determine billing cycle string
    let billingCycle: "1m" | "3m" | "1y" = "1m";
    const months = PRODUCT_MONTHS_MAP[productId];
    if (months === 3) billingCycle = "3m";
    else if (months === 12) billingCycle = "1y";

    // Calculate amount based on billing cycle (simple heuristic)
    let amount = planConfig?.monthlyPrice || 0;
    if (billingCycle === "3m") amount = (planConfig?.monthlyPrice || 0) * 3;
    if (billingCycle === "1y") amount = planConfig?.yearlyPrice || 0;


    await PaymentTransaction.create({
      userId,
      subscriptionId: existingSub ? existingSub._id : newSub?._id,
      transactionId,
      originalTransactionId,
      transactionType: PaymentTransactionType.PURCHASE,
      status: PaymentTransactionStatus.COMPLETED,
      platform: PaymentPlatform.APPLE_IAP,
      productId:transaction.productId,
      amount: Math.round(amount * 100), // Convert to cents
      currency: transaction.currency ,
      planType: resolvedPlan,
      billingCycle,
      purchaseDate,
      expiryDate: new Date(expiryMs),
      metadata: {
        rawTransaction: transaction,
      },
    });
  } catch (error) {
    console.error("Failed to log payment transaction:", error);
    // We don't throw here to avoid failing the purchase verification 
    // if only the history logging fails
  }

  return existingSub || newSub;
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
  const originalTransactionId = transaction.originalTransactionId || transactionId;
  const eventType = payload.notificationType;

  // Extract auto-renew status from renewal info if present
  let autoRenew = false;
  if (payload.data?.signedRenewalInfo) {
    try {
      const renewalInfo = await decodeRenewalInfo(payload.data.signedRenewalInfo);
      autoRenew = renewalInfo.autoRenewStatus === 1;
    } catch (e) {
      console.error("Failed to decode Apple renewal info:", e);
    }
  }

  let updateData: any = {
    auto_renew: autoRenew,
    metadata: transaction,
  };


  if (eventType === "EXPIRED") {

    updateData.status = SubscriptionStatus.EXPIRED;
    if (transaction.expiresDate) {
      updateData.end_date = new Date(transaction.expiresDate);
    }
  }

  if (eventType === "DID_RENEW") {
    updateData.status = SubscriptionStatus.ACTIVE;
    updateData.transactionId = transactionId;
    updateData.productId = transaction.productId;
    
    // Resolve and update plan type in case of plan change
    const resolvedPlan = PRODUCT_PLAN_MAP[transaction.productId];
    if (resolvedPlan) {
      updateData.plan_type = resolvedPlan;
    }


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

  // Update latest transaction info in subscription metadata
  if (updated) {
    await Subscription.findByIdAndUpdate(updated._id, { metadata: transaction });
  }


  if (updated) {
    await invalidateUserSubscriptionCache(updated.userId.toString());

    // ── Log Transaction History for Webhook Event ────────────────────────────
    try {
      let transactionType = PaymentTransactionType.RENEWAL;
      let status = PaymentTransactionStatus.COMPLETED;

      if (eventType === "EXPIRED") {
        transactionType = PaymentTransactionType.CANCELLATION;
        status = PaymentTransactionStatus.CANCELLED;
      } else if (eventType === "REFUND") {
        transactionType = PaymentTransactionType.REFUND;
        status = PaymentTransactionStatus.REFUNDED;
      }

      await PaymentTransaction.create({
        userId: updated.userId,
        subscriptionId: updated._id,
        transactionId,
        originalTransactionId,
        transactionType,
        status,
        platform: PaymentPlatform.APPLE_IAP,
        productId: transaction.productId,
        amount: 0, // Webhook might not have amount, or use 0 for status changes
        currency: "USD",
        purchaseDate: transaction.purchaseDate
          ? new Date(transaction.purchaseDate)
          : new Date(),
        expiryDate: transaction.expiresDate
          ? new Date(transaction.expiresDate)
          : undefined,
        webhookEventType: eventType,
        webhookPayload: payload,
        metadata: {
          rawTransaction: transaction,
        },
      });

    } catch (error) {
      console.error("Failed to log webhook transaction history:", error);
    }
  }

  return updated;
};


export const PaymentService = {
  verifyPurchase,
  handleAppleWebhook,
};