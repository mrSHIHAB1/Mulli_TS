// import { StatusCodes } from "http-status-codes";
// import {
//   decodeNotificationPayload,
//   decodeRenewalInfo,
//   decodeTransaction,
// } from "app-store-server-api";

// import { Request } from "express";

// import {
//   PRODUCT_PLAN_MAP,
//   VALID_PRODUCT_IDS,
// } from "../../config/iap.config";
// import { Plan, SubscriptionStatus } from "../subscription/subscription.interface";
// import Subscription from "../subscription/subscription.model";
// import AppError from "../../errorHelpers/AppError";
// import { invalidateUserSubscriptionCache } from "../../helpers/redisCache.helper";
// import PaymentTransaction from "./payment.model";
// import {
//   PaymentPlatform,
//   PaymentTransactionStatus,
//   PaymentTransactionType,
// } from "./payment.interface";
// //this is updated subscripition code
// import { SUBSCRIPTION_PLANS } from "../../config/subscriptionPlans";

// import User from "../user/user.model";

// const PLAN_TIERS: Record<string, number> = {
//   [Plan.FREE]: 0,
//   [Plan.BIRDIE]: 1,
//   [Plan.ACE]: 1,
//   [Plan.EAGLE]: 1,
// };

// const handlePlanUpgradeUsage = async (userId: string, oldPlan: string, newPlan: string) => {
//   const oldTier = PLAN_TIERS[oldPlan] || 0;
//   const newTier = PLAN_TIERS[newPlan] || 0;


//   if (newTier > oldTier) {
//     if (oldTier === 0) {
//       // Free to Paid: Reset usage
//       await User.findByIdAndUpdate(userId, {
//         $set: {
//           superLikesThisMonth: 0,
//           lastSuperLikeResetDate: new Date(),
//           boostsUsedThisMonth: 0,
//           lastBoostResetDate: new Date()
//         }
//       });
//       console.log(`User ${userId} upgraded from FREE to ${newPlan}. Reseting super like and boost usage.`);
//     } else {
//       // Lower Paid to Higher Paid: Keep usage
//       console.log(`User ${userId} upgraded from ${oldPlan} to ${newPlan}. Preserving super like and boost usage.`);
//     }
//   }
// };
// //this is updated subscripition code
// // Duration mapping for subscription plans
// const PRODUCT_MONTHS_MAP: Record<string, number> = {
//   mulli_eagle_1m: 1,
//   mulli_eagle_3m: 3,
//   mulli_birdie_1m: 1,
//   mulli_birdie_3m: 3,
//   mulli_ace_1m: 1,
//   mulli_ace_3m: 3,
// };

// // Main purchase verification service
// const verifyPurchase = async (payload: {
//   userId: string;
//   receiptData: string;
//   productId: string;
//   source: "apple" | "google";
// }) => {
//   const { userId, receiptData, productId, source } = payload;

//   // 1. Validate productId
//   if (!VALID_PRODUCT_IDS.includes(productId)) {
//     throw new AppError(StatusCodes.BAD_REQUEST, `Invalid productId: ${productId}`);
//   }

//   if (source !== "apple") {
//     throw new AppError(StatusCodes.BAD_REQUEST, "Only Apple IAP is supported currently");
//   }

//   // 2. Decode transaction
//   let transaction;
//   try {
//     transaction = await decodeTransaction(receiptData);
//   } catch (err: any) {
//     throw new AppError(StatusCodes.BAD_REQUEST, `Failed to decode Apple transaction: ${err.message}`);
//   }

//   console.log("Decoded transaction:", transaction);

//   // 3. Validate product match
//   if (transaction.productId !== productId) {
//     throw new AppError(StatusCodes.BAD_REQUEST, `Product mismatch: expected ${productId}, got ${transaction.productId}`);
//   }

//   // 4. Prevent duplicate transaction abuse
//   const existingTransaction = await Subscription.findOne({ transactionId: transaction.transactionId });
//   if (existingTransaction) {
//     return existingTransaction;
//   }

//   const transactionId = transaction.transactionId;
//   const originalTransactionId = transaction.originalTransactionId || transactionId;

//   const purchaseDate = transaction.purchaseDate ? new Date(transaction.purchaseDate) : new Date();

//   // 5. Check if subscription exists
//   const existingSub = await Subscription.findOne({ userId, originalTransactionId });

//   // 6. Handle expiry and validate
//   let expiryMs = transaction.expiresDate;

//   if (!expiryMs) {
//     if (transaction.type === "Non-Renewing Subscription") {
//       const months = PRODUCT_MONTHS_MAP[productId];
//       if (!months) {
//         throw new AppError(StatusCodes.BAD_REQUEST, `No duration mapping for productId: ${productId}`);
//       }
//       if (!transaction.purchaseDate) {
//         throw new AppError(StatusCodes.BAD_REQUEST, "Missing purchaseDate");
//       }

//       let baseDate = new Date(transaction.purchaseDate);
//       const existingActive = await Subscription.findOne({
//         userId,
//         productId: transaction.productId,
//         status: SubscriptionStatus.ACTIVE,
//       });

//       if (existingActive && existingActive.end_date > new Date()) {
//         baseDate = existingActive.end_date;
//       }

//       const expiryDate = new Date(baseDate);
//       expiryDate.setMonth(expiryDate.getMonth() + months);
//       expiryMs = expiryDate.getTime();
//     } else {
//       throw new AppError(StatusCodes.BAD_REQUEST, "Transaction missing expiry date");
//     }
//   }

//   if (expiryMs < Date.now()) {
//     throw new AppError(StatusCodes.BAD_REQUEST, `Subscription expired at ${new Date(expiryMs).toISOString()}`);
//   }

//   // 7. Resolve plan
//   const resolvedPlan = PRODUCT_PLAN_MAP[productId];
//   if (!resolvedPlan) {
//     throw new AppError(StatusCodes.BAD_REQUEST, `No plan mapping for productId: ${productId}`);
//   }

//   // 8. Update or create subscription
//   if (existingSub) {
//     //this is updated subscripition code
//     // Capture old plan before updating
//     const oldPlan = existingSub.plan_type;
//     //this is updated subscripition code
//     // Update the existing subscription if found
//     existingSub.plan_type = resolvedPlan;
//     existingSub.productId = transaction.productId;
//     existingSub.transactionId = transactionId;
//     existingSub.originalTransactionId = originalTransactionId;
//     existingSub.end_date = new Date(expiryMs);
//     existingSub.status = SubscriptionStatus.ACTIVE;
//     existingSub.metadata = transaction;

//     await existingSub.save();
//     await handlePlanUpgradeUsage(userId, oldPlan, resolvedPlan);
//     await invalidateUserSubscriptionCache(userId);
//     return existingSub;
//   }

//   // If no existing subscription, create a new one
//   const newSub = new Subscription({
//     userId,
//     plan_type: resolvedPlan,
//     status: SubscriptionStatus.ACTIVE,
//     transactionId,
//     originalTransactionId,
//     productId: transaction.productId,
//     platform: "ios",
//     start_date: purchaseDate,
//     end_date: new Date(expiryMs),
//     auto_renew: transaction.type === "Auto-Renewable Subscription",
//     metadata: transaction,
//   });

//   await newSub.save();
//   await invalidateUserSubscriptionCache(userId);

//   // 9. Log Transaction History
//   try {
//     const planConfig = SUBSCRIPTION_PLANS[resolvedPlan];
//     let billingCycle: "1m" | "3m" | "1y" = "1m";
//     const months = PRODUCT_MONTHS_MAP[productId];
//     if (months === 3) billingCycle = "3m";
//     else if (months === 12) billingCycle = "1y";

//     let amount = planConfig?.monthlyPrice || 0;
//     if (billingCycle === "3m") amount = (planConfig?.monthlyPrice || 0) * 3;
//     if (billingCycle === "1y") amount = planConfig?.yearlyPrice || 0;

//     await PaymentTransaction.findOneAndUpdate(
//       { transactionId },
//       {
//         $set: {
//           userId,
//           subscriptionId: newSub._id,
//           originalTransactionId,
//           transactionType: PaymentTransactionType.PURCHASE,
//           status: PaymentTransactionStatus.COMPLETED,
//           platform: PaymentPlatform.APPLE_IAP,
//           productId: transaction.productId,
//           amount: Math.round(amount * 100),
//           currency: transaction.currency,
//           planType: resolvedPlan,
//           billingCycle,
//           purchaseDate,
//           expiryDate: new Date(expiryMs),
//           metadata: { rawTransaction: transaction },
//         },
//       },
//       { upsert: true, new: true }
//     );
//   } catch (error) {
//     console.error("Failed to log payment transaction:", error);
//   }

//   return newSub;
// };

// // Webhook handler
// const handleAppleWebhook = async (req: Request) => {
//   const signedPayload = req.body.signedPayload;
//   if (!signedPayload) {
//     throw new Error("No signedPayload received");
//   }

//   const payload = await decodeNotificationPayload(signedPayload);
//   console.log("Decoded Apple webhook payload:", payload);

//   if (!payload.data?.signedTransactionInfo) {
//     throw new Error("No signedTransactionInfo in payload");
//   }

//   const transaction = await decodeTransaction(payload.data.signedTransactionInfo);
//   const transactionId = transaction.transactionId;
//   const originalTransactionId = transaction.originalTransactionId || transactionId;
//   const eventType = payload.notificationType;

//   // Extract auto-renew status from renewal info if present
//   let autoRenew = false;
//   if (payload.data?.signedRenewalInfo) {
//     try {
//       const renewalInfo = await decodeRenewalInfo(payload.data.signedRenewalInfo);
//       autoRenew = renewalInfo.autoRenewStatus === 1;
//     } catch (e) {
//       console.error("Failed to decode Apple renewal info:", e);
//     }
//   }

//   let updateData: any = {
//     auto_renew: autoRenew,
//     metadata: transaction,
//   };
// //this is updated subscripition code
//   if (eventType === "EXPIRED") {
//     updateData.status = SubscriptionStatus.EXPIRED;
//     if (transaction.expiresDate) {
//       updateData.end_date = new Date(transaction.expiresDate);
//     }
//   }

//   if (eventType === "DID_RENEW") {
//     updateData.status = SubscriptionStatus.ACTIVE;
//     updateData.transactionId = transactionId;
//     updateData.productId = transaction.productId;

//     const resolvedPlan = PRODUCT_PLAN_MAP[transaction.productId];
//     if (resolvedPlan) {
//       updateData.plan_type = resolvedPlan;
//     }

//     if (transaction.expiresDate) {
//       updateData.end_date = new Date(transaction.expiresDate);
//     }
//   }

//   if (eventType === "REFUND") {
//     updateData.status = SubscriptionStatus.CANCELLED;
//   }

//   if (Object.keys(updateData).length === 0) {
//     return { message: "No action needed", eventType };
//   }//this is updated subscripition code

//   // Fetch the subscription BEFORE updating to capture old plan
//   const existingSubForWebhook = await Subscription.findOne({
//     $or: [
//       { transactionId: transactionId },
//       { originalTransactionId: originalTransactionId },
//     ],
//   });
// //this is updated subscripition code
//   const updated = await Subscription.findOneAndUpdate(
//     {
//       $or: [
//         { transactionId: transactionId },
//         { originalTransactionId: originalTransactionId },
//       ],
//     },
//     updateData,
//     { returnDocument: "after" }
//   );

//   if (updated) {//this is updated subscripition code
//     // Handle plan upgrade if plan changed during renewal
//     if (eventType === "DID_RENEW" && existingSubForWebhook && updateData.plan_type) {
//       const oldPlan = existingSubForWebhook.plan_type;
//       const newPlan = updateData.plan_type;
//       if (oldPlan !== newPlan) {
//         await handlePlanUpgradeUsage(updated.userId.toString(), oldPlan, newPlan);
//       }
//     }

    
//     //this is updated subscripition code
//     await Subscription.findByIdAndUpdate(updated._id, { metadata: transaction });
//     await invalidateUserSubscriptionCache(updated.userId.toString());

//     // Log Transaction History for Webhook Event
//     try {
//       let transactionType = PaymentTransactionType.RENEWAL;
//       let status = PaymentTransactionStatus.COMPLETED;

//       if (eventType === "EXPIRED") {
//         transactionType = PaymentTransactionType.CANCELLATION;
//         status = PaymentTransactionStatus.CANCELLED;
//       } else if (eventType === "REFUND") {
//         transactionType = PaymentTransactionType.REFUND;
//         status = PaymentTransactionStatus.REFUNDED;
//       }

//       await PaymentTransaction.findOneAndUpdate(
//         { transactionId },
//         {
//           $set: {
//             userId: updated.userId,
//             subscriptionId: updated._id,
//             originalTransactionId,
//             transactionType,
//             status,
//             platform: PaymentPlatform.APPLE_IAP,
//             productId: transaction.productId,
//             purchaseDate: transaction.purchaseDate ? new Date(transaction.purchaseDate) : new Date(),
//             expiryDate: transaction.expiresDate ? new Date(transaction.expiresDate) : undefined,
//             webhookEventType: eventType,
//             webhookPayload: payload,
//             metadata: { rawTransaction: transaction },
//           },
//         },
//         { upsert: true, new: true }
//       );
//     } catch (error) {
//       console.error("Failed to log webhook transaction history:", error);
//     }
//   }

//   return updated;
// };

// export const PaymentService = {
//   verifyPurchase,
//   handleAppleWebhook,
// };
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
import { Plan, SubscriptionStatus } from "../subscription/subscription.interface";
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
import User from "../user/user.model";

// ─── Plan Tier Definitions ────────────────────────────────────────────────────

const PLAN_TIERS: Record<string, number> = {
  [Plan.FREE]: 0,
  [Plan.BIRDIE]: 1,
  [Plan.ACE]: 1,
  [Plan.EAGLE]: 1,
};

// ─── Handle Usage Reset on Plan Upgrade ──────────────────────────────────────

const handlePlanUpgradeUsage = async (
  userId: string,
  oldPlan: string,
  newPlan: string
) => {
  const oldTier = PLAN_TIERS[oldPlan] || 0;
  const newTier = PLAN_TIERS[newPlan] || 0;

  if (newTier > oldTier) {
    if (oldTier === 0) {
      // Free → Paid: Reset usage
      await User.findByIdAndUpdate(userId, {
        $set: {
          superLikesThisMonth: 0,
          lastSuperLikeResetDate: new Date(),
          boostsUsedThisMonth: 0,
          lastBoostResetDate: new Date(),
        },
      });
      console.log(
        `User ${userId} upgraded from FREE to ${newPlan}. Resetting super like and boost usage.`
      );
    } else {
      // Lower Paid → Higher Paid: Keep usage
      console.log(
        `User ${userId} upgraded from ${oldPlan} to ${newPlan}. Preserving super like and boost usage.`
      );
    }
  }
};

// ─── Duration Mapping for Non-Renewing Subscriptions ─────────────────────────

const PRODUCT_MONTHS_MAP: Record<string, number> = {
  mulli_eagle_1m: 1,
  mulli_eagle_3m: 3,
  mulli_birdie_1m: 1,
  mulli_birdie_3m: 3,
  mulli_ace_1m: 1,
  mulli_ace_3m: 3,
};

// ─── Verify Purchase (Client-Initiated) ──────────────────────────────────────

const verifyPurchase = async (payload: {
  userId: string;
  receiptData: string;
  productId: string;
  source: "apple" | "google";
}) => {
  const { userId, receiptData, productId, source } = payload;

  // 1. Validate productId
  if (!VALID_PRODUCT_IDS.includes(productId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid productId: ${productId}`);
  }

  if (source !== "apple") {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only Apple IAP is supported currently"
    );
  }

  // 2. Decode transaction
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

  // 3. Validate product match
  if (transaction.productId !== productId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Product mismatch: expected ${productId}, got ${transaction.productId}`
    );
  }

  // 4. Prevent duplicate transaction abuse
  const existingTransaction = await Subscription.findOne({
    transactionId: transaction.transactionId,
  });
  if (existingTransaction) {
    return existingTransaction;
  }

  const transactionId = transaction.transactionId;
  const originalTransactionId = transaction.originalTransactionId || transactionId;
  const purchaseDate = transaction.purchaseDate
    ? new Date(transaction.purchaseDate)
    : new Date();

  // 5. Check if subscription already exists (same user + originalTransactionId)
  const existingSub = await Subscription.findOne({ userId, originalTransactionId });

  // 6. Resolve expiry date
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
        throw new AppError(StatusCodes.BAD_REQUEST, "Missing purchaseDate");
      }

      let baseDate = new Date(transaction.purchaseDate);
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
      throw new AppError(StatusCodes.BAD_REQUEST, "Transaction missing expiry date");
    }
  }

  if (expiryMs < Date.now()) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Subscription expired at ${new Date(expiryMs).toISOString()}`
    );
  }

  // 7. Resolve plan from productId
  const resolvedPlan = PRODUCT_PLAN_MAP[productId];
  if (!resolvedPlan) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `No plan mapping for productId: ${productId}`
    );
  }

  // 8. Update or create subscription
  if (existingSub) {
    const oldPlan = existingSub.plan_type;

    existingSub.plan_type = resolvedPlan;
    existingSub.productId = transaction.productId;
    existingSub.transactionId = transactionId;
    existingSub.originalTransactionId = originalTransactionId;
    existingSub.end_date = new Date(expiryMs);
    existingSub.status = SubscriptionStatus.ACTIVE;
    existingSub.metadata = transaction;

    await existingSub.save();
    await handlePlanUpgradeUsage(userId, oldPlan, resolvedPlan);
    await invalidateUserSubscriptionCache(userId);
    return existingSub;
  }

  // Create new subscription
  const newSub = new Subscription({
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
    metadata: transaction,
  });

  await newSub.save();
  await invalidateUserSubscriptionCache(userId);

  // 9. Log payment transaction history
  try {
    const planConfig = SUBSCRIPTION_PLANS[resolvedPlan];
    let billingCycle: "1m" | "3m" | "1y" = "1m";
    const months = PRODUCT_MONTHS_MAP[productId];
    if (months === 3) billingCycle = "3m";
    else if (months === 12) billingCycle = "1y";

    let amount = planConfig?.monthlyPrice || 0;
    if (billingCycle === "3m") amount = (planConfig?.monthlyPrice || 0) * 3;
    if (billingCycle === "1y") amount = planConfig?.yearlyPrice || 0;

    await PaymentTransaction.findOneAndUpdate(
      { transactionId },
      {
        $set: {
          userId,
          subscriptionId: newSub._id,
          originalTransactionId,
          transactionType: PaymentTransactionType.PURCHASE,
          status: PaymentTransactionStatus.COMPLETED,
          platform: PaymentPlatform.APPLE_IAP,
          productId: transaction.productId,
          amount: Math.round(amount * 100),
          currency: transaction.currency,
          planType: resolvedPlan,
          billingCycle,
          purchaseDate,
          expiryDate: new Date(expiryMs),
          metadata: { rawTransaction: transaction },
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Failed to log payment transaction:", error);
  }

  return newSub;
};

// ─── Apple Server-to-Server Webhook Handler ───────────────────────────────────

const handleAppleWebhook = async (req: Request) => {
  const signedPayload = req.body.signedPayload;
  if (!signedPayload) throw new Error("No signedPayload received");

  // ─────────────────────────────────────────────
  // 1. Decode webhook
  // ─────────────────────────────────────────────
  const payload = await decodeNotificationPayload(signedPayload);

  const notificationUUID = payload.notificationUUID;
  const eventType = payload.notificationType;

  console.log("Apple webhook event:", eventType);

  // ─────────────────────────────────────────────
  // 2. Idempotency check (VERY IMPORTANT)
  // ─────────────────────────────────────────────
  const alreadyProcessed = await PaymentTransaction.findOne({
    "webhookPayload.notificationUUID": notificationUUID,
  });

  if (alreadyProcessed) {
    console.log("Duplicate webhook ignored");
    return { message: "Duplicate event ignored" };
  }

  if (!payload.data?.signedTransactionInfo) {
    throw new Error("Missing transaction info");
  }

  const transaction = await decodeTransaction(
    payload.data.signedTransactionInfo
  );

  const transactionId = transaction.transactionId;
  const originalTransactionId =
    transaction.originalTransactionId || transactionId;

  const resolvedPlan = PRODUCT_PLAN_MAP[transaction.productId];

  // ─────────────────────────────────────────────
  // 3. Find subscription (ONLY by originalTransactionId)
  // ─────────────────────────────────────────────
  let subscription = await Subscription.findOne({
    originalTransactionId,
  });

  // ─────────────────────────────────────────────
  // 4. CREATE if missing (FIX FOR YOUR BUG)
  // ─────────────────────────────────────────────
  if (!subscription) {
    console.log("Subscription missing → creating new one");

    subscription = await Subscription.create({
      originalTransactionId,
      transactionId,
      productId: transaction.productId,
      plan_type: resolvedPlan,
      platform: "ios",
      start_date: transaction.purchaseDate
        ? new Date(transaction.purchaseDate)
        : new Date(),
      end_date: new Date(transaction.expiresDate || 0),
      status: SubscriptionStatus.ACTIVE,
      auto_renew: true,
      metadata: transaction,
    });
  }

  // ─────────────────────────────────────────────
  // 5. Skip stale updates (IMPORTANT)
  // ─────────────────────────────────────────────
  if (
    subscription.end_date &&
    transaction.expiresDate &&
    new Date(subscription.end_date) >
      new Date(transaction.expiresDate)
  ) {
    console.log("Stale webhook ignored");
    return;
  }

  // ─────────────────────────────────────────────
  // 6. Extract auto-renew
  // ─────────────────────────────────────────────
  let autoRenew = false;

  if (payload.data?.signedRenewalInfo) {
    try {
      const renewalInfo = await decodeRenewalInfo(
        payload.data.signedRenewalInfo
      );
      autoRenew = renewalInfo.autoRenewStatus === 1;
    } catch (err) {
      console.error("Renewal decode failed", err);
    }
  }

  // ─────────────────────────────────────────────
  // 7. Build update data
  // ─────────────────────────────────────────────
  const updateData: any = {
    auto_renew: autoRenew,
    metadata: transaction,
  };

  switch (eventType) {
    case "DID_RENEW":
      updateData.status = SubscriptionStatus.ACTIVE;
      updateData.transactionId = transactionId;
      updateData.productId = transaction.productId;

      if (resolvedPlan) {
        updateData.plan_type = resolvedPlan;
      }

      if (transaction.expiresDate) {
        updateData.end_date = new Date(transaction.expiresDate);
      }
      break;

    case "EXPIRED":
      updateData.status = SubscriptionStatus.EXPIRED;
      break;

    case "DID_FAIL_TO_RENEW":
      updateData.status = SubscriptionStatus.PAST_DUE;
      break;

    case "GRACE_PERIOD_EXPIRED":
      updateData.status = SubscriptionStatus.EXPIRED;
      break;

    case "REFUND":
      updateData.status = SubscriptionStatus.CANCELLED;
      break;

    case "DID_CHANGE_RENEWAL_STATUS":
      updateData.auto_renew = autoRenew;
      break;

    default:
      console.log("Unhandled event:", eventType);
      return { message: "Ignored event" };
  }

  // ─────────────────────────────────────────────
  // 8. Update subscription safely
  // ─────────────────────────────────────────────
  const updated = await Subscription.findOneAndUpdate(
    { originalTransactionId },
    { $set: updateData },
    { new: true }
  );

  if (!updated) {
    console.error("Subscription update failed");
    return;
  }

  // ─────────────────────────────────────────────
  // 9. Cache cleanup
  // ─────────────────────────────────────────────
  await invalidateUserSubscriptionCache(updated.userId.toString());

  // ─────────────────────────────────────────────
  // 10. Payment transaction logging (idempotent)
  // ─────────────────────────────────────────────
  try {
    await PaymentTransaction.findOneAndUpdate(
      { transactionId },
      {
        $set: {
          userId: updated.userId,
          subscriptionId: updated._id,
          originalTransactionId,
          transactionType:
            eventType === "DID_RENEW"
              ? PaymentTransactionType.RENEWAL
              : PaymentTransactionType.PURCHASE,
          status:
            eventType === "REFUND"
              ? PaymentTransactionStatus.REFUNDED
              : PaymentTransactionStatus.COMPLETED,
          platform: PaymentPlatform.APPLE_IAP,
          productId: transaction.productId,
          purchaseDate: transaction.purchaseDate
            ? new Date(transaction.purchaseDate)
            : new Date(),
          expiryDate: transaction.expiresDate
            ? new Date(transaction.expiresDate)
            : undefined,
          webhookEventType: eventType,
          webhookPayload: payload,
          metadata: { rawTransaction: transaction },
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Payment log error:", err);
  }

  console.log("Subscription updated successfully:", updated._id);

  return updated;
};
// ─── Exports ──────────────────────────────────────────────────────────────────

export const PaymentService = {
  verifyPurchase,
  handleAppleWebhook,
};