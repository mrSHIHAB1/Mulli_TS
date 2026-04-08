import axios from "axios";
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

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// ── helpers ──────────────────────────────────────────────────────────────────

const verifyWithApple = async (receiptData: string, url: string) => {
  const response = await axios.post(url, {
    "receipt-data": receiptData,
    password: process.env.APPLE_SHARED_SECRET,
    "exclude-old-transactions": true,
  });
  return response.data;
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
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid productId: ${productId}`);
  }

  if (source !== "apple") {
    throw new AppError(StatusCodes.BAD_REQUEST, "Only Apple IAP is supported currently");
  }

  // --- 2. Verify receipt with Apple ---
  let appleResponse = await verifyWithApple(receiptData, APPLE_PRODUCTION_URL);

  // Sandbox receipt sent to production → retry against sandbox
  if (appleResponse.status === 21007) {
    appleResponse = await verifyWithApple(receiptData, APPLE_SANDBOX_URL);
  }

  if (appleResponse.status !== 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Apple verification failed. Status: ${appleResponse.status}`
    );
  }

  // --- 3. Find latest matching transaction ---
  const latestReceipts: any[] = appleResponse.latest_receipt_info || [];

  const matchingReceipt = latestReceipts
    .filter((r) => r.product_id === productId)
    .sort((a, b) => Number(b.purchase_date_ms) - Number(a.purchase_date_ms))[0];

  if (!matchingReceipt) {
    throw new AppError(StatusCodes.BAD_REQUEST, "No matching transaction found for this product");
  }

  // --- 4. Check expiry ---
  const expiryMs = Number(matchingReceipt.expires_date_ms);
  const nowMs = Date.now();

  if (expiryMs < nowMs) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Subscription expired at ${new Date(expiryMs).toISOString()}`
    );
  }

  // --- 5. Resolve internal Plan from productId ---
  const resolvedPlan = PRODUCT_PLAN_MAP[productId];

  // --- 6. Check for existing active subscription ---
  const existingSub = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.ACTIVE,
  });

  if (existingSub) {
    // Update existing instead of throwing — user may be renewing/upgrading
    const updated = await Subscription.findByIdAndUpdate(
      existingSub._id,
      {
        plan_type: resolvedPlan,
        transactionId: matchingReceipt.transaction_id,
        originalTransactionId: matchingReceipt.original_transaction_id || matchingReceipt.transaction_id,
        end_date: new Date(expiryMs),
        status: SubscriptionStatus.ACTIVE,
      },
      { new: true }
    );
    // Invalidate cache
    await invalidateUserSubscriptionCache(userId);
    return updated;
  }

  // --- 7. Create new subscription ---
  const newSub = await Subscription.create({
    userId,
    plan_type: resolvedPlan,
    status: SubscriptionStatus.ACTIVE,
    transactionId: matchingReceipt.transaction_id,
    originalTransactionId: matchingReceipt.original_transaction_id || matchingReceipt.transaction_id,
    productId,
    platform: "ios",
    start_date: new Date(Number(matchingReceipt.purchase_date_ms)),
    end_date: new Date(expiryMs),
    auto_renew: matchingReceipt.is_in_intro_offer_period !== "true",
  });

  // Invalidate cache
  await invalidateUserSubscriptionCache(userId);

  return newSub;
};

const handleAppleWebhook = async (req: Request) => {
  const signedPayload = req.body.signedPayload;

  if (!signedPayload) {
    throw new Error("No signedPayload received");
  }

  // Decode Apple payload
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
    // If subtype is AUTO_RENEW_DISABLED or similar, we might want to track it
    // but for now let's just update expiry if available
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

  // Update DB by originalTransactionId as it's the most stable identifier
  const updated = await Subscription.findOneAndUpdate(
    { 
      $or: [
        { transactionId: transactionId }, 
        { originalTransactionId: originalTransactionId }
      ] 
    },
    updateData,
    { new: true }
  );

  if (updated) {
    console.log(`Webhook updated subscription ${updated._id} for user ${updated.userId}`);
    await invalidateUserSubscriptionCache(updated.userId.toString());
  } else {
    console.warn(`Webhook received for unknown subscription. transactionId: ${transactionId}, originalTransactionId: ${originalTransactionId}`);
  }

  return updated;
};

export const PaymentService = {
  verifyPurchase,
  handleAppleWebhook,
};