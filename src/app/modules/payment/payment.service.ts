import axios from "axios";
import { StatusCodes } from "http-status-codes";



import { PRODUCT_PLAN_MAP, VALID_PRODUCT_IDS } from "../../config/iap.config";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import Subscription from "../subscription/subscription.model";
import AppError from "../../errorHelpers/AppError";


const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL    = "https://sandbox.itunes.apple.com/verifyReceipt";

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
  const nowMs    = Date.now();

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
        plan_type:            resolvedPlan,
        transactionId:        matchingReceipt.transaction_id,
        originalTransactionId: matchingReceipt.original_transaction_id || matchingReceipt.transaction_id,
        end_date:             new Date(expiryMs),
        status:               SubscriptionStatus.ACTIVE,
      },
      { new: true }
    );
    return updated;
  }

  // --- 7. Create new subscription ---
  const newSub = await Subscription.create({
    userId,
    plan_type:            resolvedPlan,
    status:               SubscriptionStatus.ACTIVE,
    transactionId:        matchingReceipt.transaction_id,
    originalTransactionId: matchingReceipt.original_transaction_id || matchingReceipt.transaction_id,
    productId,
    platform:             "ios",
    start_date:           new Date(Number(matchingReceipt.purchase_date_ms)),
    end_date:             new Date(expiryMs),
    auto_renew:           matchingReceipt.is_in_intro_offer_period !== "true",
  });

  return newSub;
};

export const PaymentService = { 
    
    verifyPurchase

};