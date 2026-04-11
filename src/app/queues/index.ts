import { Queue } from "bullmq";
import { bullmqConnection } from "../config/bullmq.config";


// -------------------------------------------------------
// Queue Names — single source of truth
// -------------------------------------------------------
export const QUEUE_NAMES = {
  EMAIL: "email",
  NOTIFICATION: "notification",
  SUBSCRIPTION_EXPIRY: "subscription-expiry",
} as const;

// -------------------------------------------------------
// Email Queue
// Send transactional emails (welcome, match, etc.)
// -------------------------------------------------------
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// -------------------------------------------------------
// Notification Queue
// Send push notifications via Firebase FCM
// -------------------------------------------------------

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// -------------------------------------------------------
// Subscription Expiry Queue
// Schedule subscription expiry checks
// -------------------------------------------------------
export const subscriptionExpiryQueue = new Queue(QUEUE_NAMES.SUBSCRIPTION_EXPIRY, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

