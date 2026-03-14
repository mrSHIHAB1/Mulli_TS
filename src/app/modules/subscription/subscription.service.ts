import { Types } from "mongoose";
import Subscription from "./subscription.model";
import { ISubscription, SubscriptionStatus } from "./subscription.interface";
import AppError from "../../errorHelpers/AppError";
import { StatusCodes } from "http-status-codes";

const createSubscription = async (payload: ISubscription) => {
  // Check if active subscription already exists
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

const getMySubscription = async (userId: string) => {
  const subscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    status: SubscriptionStatus.ACTIVE,
  }).sort({ createdAt: -1 }); // Get the latest active

  return subscription;
};

const updateSubscriptionStatus = async (
  transactionId: string,
  status: SubscriptionStatus
) => {
  const subscription = await Subscription.findOneAndUpdate(
    { transactionId },
    { status },
    { new: true }
  );

  if (!subscription) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subscription not found");
  }

  return subscription;
};

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

  return subscription;
};

const subscriptionWebhook = async (payload: any) => {
  // Dummy webhook logic; typically verifies payload signature from Google/Apple,
  // extracts transactionId, and updates status (e.g., renewed, canceled, failed).

  const { transactionId, status } = payload;
  if (!transactionId || !status) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Invalid webhook payload");
  }

  // Update logic based on webhook info
  await updateSubscriptionStatus(transactionId, status as SubscriptionStatus);

  return { received: true };
};

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

  const [data, total] = await Promise.all([
    Subscription.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "firstName lastName email"),
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

export const SubscriptionService = {
  createSubscription,
  getMySubscription,
  updateSubscriptionStatus,
  getAllSubscriptions,
  cancelSubscription,
  subscriptionWebhook,
};