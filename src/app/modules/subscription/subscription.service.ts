import { Types } from "mongoose";
import Subscription from "./subscription.model";
import { ISubscription, SubscriptionStatus } from "./subscription.interface";
import AppError from "../../errorHelpers/AppError";
import { StatusCodes } from "http-status-codes";
import {
  cacheUserSubscription,
  getCachedUserSubscription,
  invalidateUserSubscriptionCache,
} from "../../helpers/redisCache.helper";

const createSubscription = async (payload: ISubscription) => {
  // Check if user has an active subscription already
  const existingSub = await Subscription.findOne({
    userId: payload.userId,
    status: SubscriptionStatus.ACTIVE,
  });

  if (existingSub) {
    throw new AppError(  
      StatusCodes.BAD_REQUEST,
      "User already has an active subscription"
    );
  }

  const newSub = await Subscription.create(payload);
  return newSub;
};

/**
 * Get latest active subscription for user
 */
const getMySubscription = async (userId: string) => {
  const cachedSubscription = await getCachedUserSubscription(userId);
  if (cachedSubscription !== undefined) {
    if (cachedSubscription === null) return null;

    // Check if cached subscription has expired
    if (cachedSubscription.end_date && new Date() > new Date(cachedSubscription.end_date)) {
      const actualSub = await Subscription.findOne({ _id: (cachedSubscription as any)._id || (cachedSubscription as any).id });
      if (actualSub) {
        actualSub.status = SubscriptionStatus.EXPIRED;
        await actualSub.save();
      }
      await invalidateUserSubscriptionCache(userId);
      return null;
    }

    return cachedSubscription;
  }

  const subscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    status: SubscriptionStatus.ACTIVE,
  }).sort({ createdAt: -1 }).lean();

  if (!subscription) {
    await cacheUserSubscription(userId, null);
    return null;
  }

  // Check if subscription has expired
  if (subscription.end_date && new Date() > subscription.end_date) {
    await Subscription.findByIdAndUpdate(subscription._id, { status: SubscriptionStatus.EXPIRED });
    subscription.status = SubscriptionStatus.EXPIRED;
    await cacheUserSubscription(userId, null);
    return null;
  }

  await cacheUserSubscription(userId, subscription as any);

  return subscription;
};

/**
 * Get subscription history for user
 */
const getSubscriptionHistory = async (userId: string, limit: number = 10) => {
  const subscriptions = await Subscription.find({
    userId: new Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(limit);

  return subscriptions;
};

/**
 * Update subscription status (admin/webhook)
 */
const updateSubscriptionStatus = async (
  transactionId: string,
  status: SubscriptionStatus
) => {
  const subscription = await Subscription.findOneAndUpdate(
    { transactionId },
    { status, updatedAt: new Date() },
    { new: true }
  );

  if (!subscription) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subscription not found");
  }

  // Invalidate user subscription cache
  const userId = subscription.userId.toString();
  await invalidateUserSubscriptionCache(userId);

  return subscription;
};

/**
 * Cancel active subscription for user
 */
const cancelSubscription = async (userId: string) => {
  const subscription = await Subscription.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
    },
    {
      status: SubscriptionStatus.CANCELLED,
      auto_renew: false,
    },
    { new: true }
  );

  if (!subscription) {
    throw new AppError(StatusCodes.NOT_FOUND, "Active subscription not found");
  }

  // Invalidate cache when subscription is cancelled
  await invalidateUserSubscriptionCache(userId);

  return subscription;
};

/**
 * Process Apple/Google webhook events
 * Webhook signature validation should be done before calling this
 */
const subscriptionWebhook = async (payload: any) => {
  // This should be platform-specific
  // For now, basic validation

  const { transactionId, status, type, platform } = payload;
  
  if (!transactionId || !status) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Invalid webhook payload");
  }

  // Handle different event types
  switch (type) {
    case "SUBSCRIPTION_RENEWED":
      return updateSubscriptionStatus(transactionId, SubscriptionStatus.ACTIVE);
    
    case "SUBSCRIPTION_EXPIRED":
      return updateSubscriptionStatus(transactionId, SubscriptionStatus.EXPIRED);
    
    case "SUBSCRIPTION_CANCELLED":
      return updateSubscriptionStatus(transactionId, SubscriptionStatus.CANCELLED);
    
    case "SUBSCRIPTION_REVOKED":
      return updateSubscriptionStatus(transactionId, SubscriptionStatus.CANCELLED);
    
    default:
      return { received: true, message: "Event type not handled" };
  }
};

/**
 * Get all subscriptions with pagination and filtering
 */
const getAllSubscriptions = async (query: Record<string, any>) => {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;

  const filters: Record<string, any> = {};

  if (query.status) {
    filters.status = query.status;
  }
  if (query.plan_type) {
    filters.plan_type = query.plan_type;
  }
  if (query.platform) {
    filters.platform = query.platform;
  }

  const [data, total] = await Promise.all([
    Subscription.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "firstName lastName email"),
    Subscription.countDocuments(filters),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

/**
 * Get subscription statistics (admin)
 */
const getSubscriptionStats = async () => {
  const stats = await Subscription.aggregate([
    {
      $group: {
        _id: "$plan_type",
        count: { $sum: 1 },
        totalSpent: { $sum: "$total_spent" },
        activeCount: {
          $sum: { $cond: [{ $eq: ["$status", SubscriptionStatus.ACTIVE] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
};

/**
 * Check if user has active subscription
 */
const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  // Check cache first
  const cachedSubscription = await getCachedUserSubscription(userId);
  if (cachedSubscription !== undefined) {
    if (cachedSubscription === null) return false;
    
    // Check if cached subscription has expired
    if (cachedSubscription.end_date && new Date() > new Date(cachedSubscription.end_date)) {
      return false;
    }
    return cachedSubscription.status === SubscriptionStatus.ACTIVE;
  }

  const subscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    status: SubscriptionStatus.ACTIVE,
    end_date: { $gt: new Date() },
  });

  if (subscription) {
    // Cache the subscription
    await cacheUserSubscription(userId, subscription);
  } else {
    // Cache the null result
    await cacheUserSubscription(userId, null);
  }

  return !!subscription;
};

export const SubscriptionService = {
  createSubscription,
  getMySubscription,
  getSubscriptionHistory,
  updateSubscriptionStatus,
  getAllSubscriptions,
  cancelSubscription,
  subscriptionWebhook,
  getSubscriptionStats,
  hasActiveSubscription,
};