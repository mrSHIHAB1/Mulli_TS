import axios from "axios";
import { StatusCodes } from "http-status-codes";

import crypto from "crypto";
import AppError from "../errorHelpers/AppError";

// ── Apple IAP Constants ──────────────────────────────────────────────────────

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// Apple status codes
enum AppleStatus {
  VALID = 0,
  INVALID = 1,
  AUTH_ERROR = 2,
  SANDBOX_RECEIPT = 21007,
}

interface AppleReceiptInfo {
  transaction_id: string;
  original_transaction_id: string;
  product_id: string;
  purchase_date_ms: string;
  expires_date_ms: string;
  is_trial_period?: string;
  is_in_intro_offer_period?: string;
  web_order_line_item_id?: string;
}

interface AppleVerifyResponse {
  status: number;
  receipt?: {
    in_app?: AppleReceiptInfo[];
  };
  latest_receipt_info?: AppleReceiptInfo[];
  latest_receipt?: string;
}

// ── Apple IAP Verification ──────────────────────────────────────────────────

/**
 * Verify Apple receipt against Apple servers
 */
export const verifyAppleReceipt = async (
  receiptData: string,
  url: string = APPLE_PRODUCTION_URL
): Promise<AppleVerifyResponse> => {
  const response = await axios.post(
    url,
    {
      "receipt-data": receiptData,
      password: process.env.APPLE_SHARED_SECRET,
      "exclude-old-transactions": true,
    },
    {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

/**
 * Extract subscription info from Apple receipt
 */
export const parseAppleReceipt = (appleResponse: AppleVerifyResponse, productId: string) => {
  if (!appleResponse || appleResponse.status !== AppleStatus.VALID) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Apple verification failed. Status: ${appleResponse?.status}`
    );
  }

  // Get latest receipts with fallback to older format
  const receipts: AppleReceiptInfo[] = appleResponse.latest_receipt_info || 
    appleResponse.receipt?.in_app || [];

  if (!receipts.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, "No receipt information found");
  }

  // Find matching product
  const matchingReceipt = receipts
    .filter((r) => r.product_id === productId)
    .sort((a, b) => Number(b.purchase_date_ms) - Number(a.purchase_date_ms))[0];

  if (!matchingReceipt) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `No active subscription found for product: ${productId}`
    );
  }

  return matchingReceipt;
};

/**
 * Check if Apple receipt is still valid (not expired)
 */
export const isAppleReceiptValid = (receiptInfo: AppleReceiptInfo): boolean => {
  const expiryMs = Number(receiptInfo.expires_date_ms);
  const nowMs = Date.now();
  return expiryMs > nowMs;
};

/**
 * Get expiry date from Apple receipt
 */
export const getAppleExpiryDate = (receiptInfo: AppleReceiptInfo): Date => {
  return new Date(Number(receiptInfo.expires_date_ms));
};

/**
 * Full Apple verification flow
 */
export const verifyAppleReceiptFull = async (
  receiptData: string,
  productId: string
) => {
  // Try production first
  let appleResponse = await verifyAppleReceipt(receiptData, APPLE_PRODUCTION_URL);

  // If sandbox receipt sent to production, retry against sandbox
  if (appleResponse.status === AppleStatus.SANDBOX_RECEIPT) {
    appleResponse = await verifyAppleReceipt(receiptData, APPLE_SANDBOX_URL);
  }

  const receiptInfo = parseAppleReceipt(appleResponse, productId);

  if (!isAppleReceiptValid(receiptInfo)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Subscription expired at ${getAppleExpiryDate(receiptInfo).toISOString()}`
    );
  }

  return {
    transactionId: receiptInfo.transaction_id,
    originalTransactionId: receiptInfo.original_transaction_id,
    productId: receiptInfo.product_id,
    startDate: new Date(Number(receiptInfo.purchase_date_ms)),
    expiryDate: getAppleExpiryDate(receiptInfo),
    isTrialPeriod: receiptInfo.is_trial_period === "true",
    isIntroOffer: receiptInfo.is_in_intro_offer_period === "true",
  };
};

// ── Google Play IAP Constants & Types ────────────────────────────────────────

interface GooglePlaySubscription {
  kind: string;
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  countryCode: string;
  orderId: string;
  packageName: string;
  subscriptionId: string;
  purchaseType: string;
  acknowledgementState: number;
  cancelledTimestampMillis?: string;
  developerPayload?: string;
}

/**
 * Verify Google Play subscription purchase
 * Requires Google Service Account credentials in environment
 */
export const verifyGooglePlaySubscription = async (
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<GooglePlaySubscription> => {
  try {
    // Import Google APIs library
    const { google } = require("googleapis");

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const client = await auth.getClient();
    const androidPublisher = google.androidpublisher({
      version: "v3",
      auth: client,
    });

    const response = await androidPublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const subscription = response.data;

    if (!subscription || !subscription.startTimeMillis || !subscription.expiryTimeMillis) {
      throw new AppError(StatusCodes.BAD_REQUEST, "Invalid Google Play subscription data");
    }

    return subscription;
  } catch (error: any) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Google Play verification failed: ${error.message}`
    );
  }
};

/**
 * Check if Google Play subscription is still valid
 */
export const isGooglePlaySubscriptionValid = (subscription: GooglePlaySubscription): boolean => {
  const expiryMs = Number(subscription.expiryTimeMillis);
  const nowMs = Date.now();
  const isCancelled = !!subscription.cancelledTimestampMillis;
  return expiryMs > nowMs && !isCancelled;
};

/**
 * Full Google Play verification flow
 */
export const verifyGooglePlaySubscriptionFull = async (
  packageName: string,
  productId: string,
  purchaseToken: string
) => {
  const subscription = await verifyGooglePlaySubscription(packageName, productId, purchaseToken);

  if (!isGooglePlaySubscriptionValid(subscription)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Google Play subscription is invalid or expired"
    );
  }

  return {
    transactionId: subscription.orderId,
    originalTransactionId: subscription.orderId,
    productId: subscription.subscriptionId,
    startDate: new Date(Number(subscription.startTimeMillis)),
    expiryDate: new Date(Number(subscription.expiryTimeMillis)),
    autoRenewing: subscription.autoRenewing,
    isValid: isGooglePlaySubscriptionValid(subscription),
  };
};

// ── Webhook Verification ────────────────────────────────────────────────────

/**
 * Verify Apple Server Notification signature
 * Returns payload if valid, throws if invalid
 */
export const verifyAppleWebhookSignature = (
  signatureData: string,
  payload: Buffer
): any => {
  try {
    // In production, implement proper PKCS#7 verification
    // This is a placeholder - implement based on Apple's documentation
    
    // For now, just parse and validate basic structure
    const decodedPayload = JSON.parse(payload.toString());
    
    if (!decodedPayload.signedPayload) {
      throw new Error("Missing signedPayload");
    }

    return decodedPayload;
  } catch (error: any) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid Apple webhook signature: ${error.message}`);
  }
};

/**
 * Verify Google Play webhook signature
 */
export const verifyGooglePlayWebhookSignature = (
  message: any,
  signature: string,
  publicKey: string
): boolean => {
  try {
    const publicKeyObj = crypto.createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });

    const verifier = crypto.createVerify("sha256");
    verifier.update(JSON.stringify(message));
    
    return verifier.verify(publicKeyObj, Buffer.from(signature, "base64"));
  } catch (error) {
    return false;
  }
};
