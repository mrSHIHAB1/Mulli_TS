import { Worker, Job } from "bullmq";
import { bullmqConnection } from "../config/bullmq.config";
import { QUEUE_NAMES } from "../queues";
import { NotificationService } from "../modules/notification/notification.service";
import Subscription from "../modules/subscription/subscription.model";
import { SubscriptionStatus } from "../modules/subscription/subscription.interface";


// -------------------------------------------------------
// Email Worker
// Processes transactional email jobs
// -------------------------------------------------------
export const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job: Job) => {
    const { to, subject } = job.data;
    console.log(`[EmailWorker] Processing job ${job.id} - sending to ${to}: "${subject}"`);

    // TODO: plug in your email provider here
    // Example: await sendEmail({ to, subject, html: job.data.html });
  },
  {
    connection: bullmqConnection,
    concurrency: 5,
  }
);

emailWorker.on("completed", (job) => {
  console.log(`[EmailWorker] Job ${job.id} completed`);
});
emailWorker.on("failed", (job, err) => {
  console.error(`[EmailWorker] Job ${job?.id} failed: ${err.message}`);
});

// -------------------------------------------------------
// Notification Worker
// Sends push + in-app notifications via existing NotificationService
// Job data: { receiverId, senderId, senderName, type }
// -------------------------------------------------------
export const notificationWorker = new Worker(
  QUEUE_NAMES.NOTIFICATION,
  async (job: Job) => {
    const { receiverId, senderId, senderName, type } = job.data;
    console.log(`[NotificationWorker] Processing job ${job.id} | type=${type} | to=${receiverId}`);

    if (type === "like") {
      await NotificationService.notifyNewLike(receiverId, senderId, senderName);
    } else if (type === "match") {
      const { matchId } = job.data;
      await NotificationService.notifyNewMatch(senderId, receiverId, matchId);
    } else if (type === "post_liked") {
      const { postId } = job.data;
      await NotificationService.notifyPostLiked(receiverId, senderId, senderName, postId);
    } else if (type === "post_commented") {
      const { postId } = job.data;
      await NotificationService.notifyPostCommented(receiverId, senderId, senderName, postId);
    }

    console.log(`[NotificationWorker] Notification dispatched to ${receiverId}`);
  },
  {
    connection: bullmqConnection,
    concurrency: 10,
  }
);

notificationWorker.on("completed", (job) => {
  console.log(`[NotificationWorker] Job ${job.id} completed`);
});
notificationWorker.on("failed", (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed: ${err.message}`);
});

// -------------------------------------------------------
// Subscription Expiry Worker
// Marks expired subscriptions as EXPIRED
// -------------------------------------------------------
export const subscriptionExpiryWorker = new Worker(
  QUEUE_NAMES.SUBSCRIPTION_EXPIRY,
  async (job: Job) => {
    const { subscriptionId } = job.data;
    console.log(`[SubExpiryWorker] Processing job ${job.id} for subscription ${subscriptionId}`);

    await Subscription.findByIdAndUpdate(subscriptionId, {
      status: SubscriptionStatus.EXPIRED,
    });

    console.log(`[SubExpiryWorker] Subscription ${subscriptionId} marked as EXPIRED`);
  },
  {
    connection: bullmqConnection,
    concurrency: 3,
  }
);

subscriptionExpiryWorker.on("completed", (job) => {
  console.log(`[SubExpiryWorker] Job ${job.id} completed`);
});
subscriptionExpiryWorker.on("failed", (job, err) => {
  console.error(`[SubExpiryWorker] Job ${job?.id} failed: ${err.message}`);
});

// -------------------------------------------------------
// Graceful shutdown helper
// -------------------------------------------------------
export const closeAllWorkers = async () => {
  console.log("[BullMQ] Closing all workers...");
  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
    subscriptionExpiryWorker.close(),
  ]);
  console.log("[BullMQ] All workers closed.");
};
