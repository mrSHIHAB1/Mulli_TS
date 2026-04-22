/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import User from "../user/user.model";
import { ClubhouseBadge, Role } from "../user/user.interface";
import { Notification } from "./notification.model";
import { INotificationData, NotificationType } from "./notification.interface";
import { getIo } from "../socket/socket.store";
import { sendPushToTokens } from "../../utils/sendPushNotification";

const NOTI_ROOM = (userId: string) => `notification_${userId}`;

//  socket emit to notification room
const emitNotification = (userIds: (string | Types.ObjectId)[], payload: any,) => {
  try {
    const io = getIo();
    userIds.forEach((id) => {
      io.to(NOTI_ROOM(String(id))).emit("notification", payload);
    });
  } catch {
    // socket not initialized
  }
};

const createInApp = async (
  userIds: Types.ObjectId[],
  type: NotificationType,
  title: string,
  body: string,
  data?: INotificationData,
) => {
  if (!userIds.length) return [];

  const docs = userIds.map((id) => ({
    user: id,
    type,
    title,
    body,
    data,
    isRead: false,
  }));

  return Notification.insertMany(docs);
};

const pushToUserIds = async (
  userIds: Types.ObjectId[],
  title: string,
  body: string,
  data?: INotificationData,
) => {
  const users = await User.find({ 
    _id: { $in: userIds },
    isOnline: { $ne: true } // Only push to users who are NOT online
  }).select("fcmTokens");

  const tokens = users.flatMap((u: any) => u.fcmTokens || []).filter(Boolean);

  if (!tokens.length) return { successCount: 0, failureCount: 0 };
  console.log(tokens)
  //  important: data must be string or firebase will fail
  return sendPushToTokens(tokens, title, body, data);
};



const notifyChatMessage = async (
  receiverId: string,
  sender: any,
  messageDoc: any,
) => {
  const senderId = String(sender?._id ?? sender);

  // Prevent self-notification
  if (String(receiverId) === senderId) {
    return { inAppCount: 0, successCount: 0, failureCount: 0 };
  }

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = "New message received";
  const senderName = sender?.full_name || 
                     (sender?.firstName && sender?.lastName ? `${sender.firstName} ${sender.lastName}` : (sender?.firstName || sender?.name || "Someone"));
  const body = `${senderName} sent you a message`;

  const data: INotificationData = {
    senderId,
    receiverId,
    chatId: String(messageDoc?._id),

  };

  // Save in-app notification
  const saved = await createInApp(
    [receiverObjectId],
    NotificationType.CHAT_MESSAGE,
    title,
    body,
    data,
  );

  // Push notification
  const pushed = await pushToUserIds([receiverObjectId], title, body, data);

  // Emit via socket to receiver notification room

  const io = getIo();
  io.to(`notification_${receiverId}`).emit("notification", {
    type: NotificationType.CHAT_MESSAGE,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length, ...pushed };
};

const getMyNotifications = async (
  userId: string,
  query: Record<string, string>,
) => {
  // const page = Math.max(Number(query.page || 1), 1);
  // const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  // const skip = (page - 1) * limit;

  const userObjectId = new Types.ObjectId(userId); // ✅ convert to ObjectId

  const [data, total] = await Promise.all([
    Notification.find({ user: userObjectId })
      .sort({ createdAt: -1 }),
    // .skip(skip)
    // .limit(limit),
    Notification.countDocuments({ user: userObjectId }),
  ]);

  return {
    meta: {
      // page,
      // limit,
      total,
      // totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const markAsRead = async (userId: string, notificationId: string) => {
  await Notification.updateOne(
    { _id: notificationId, user: userId },
    { $set: { isRead: true } },
  );
  return null;
};

const deleteNotification = async (notificationId: string) => {
  return Notification.deleteOne({ _id: notificationId });
};

const markAllRead = async (userId: string) => {
  // ✅ update all notifications for this user to isRead = true
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true } },
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
};
// In notification.service.ts
const notifyAdminsFeedbackSubmitted = async (feedback: any) => {
  // Get admins
  const admins = await User.find({
    role: { $in: [Role.ADMIN] },
  }).select("_id fcmTokens");

  const adminIds = admins.map((a: any) => a._id as Types.ObjectId);

  if (!adminIds.length)
    return { inAppCount: 0, successCount: 0, failureCount: 0 };

  const title = "New Feedback Submitted";
  const body = `"${feedback.title}" has been submitted by a user.`;

  const data: INotificationData = {
    feedbackId: String(feedback._id),
    deepLink: `/feedback/${feedback._id}`,
  };

  const saved = await createInApp(
    adminIds,
    NotificationType.FEEDBACK_SUBMITTED,
    title,
    body,
    data,
  );
  const pushed = await pushToUserIds(adminIds, title, body, data);

  emitNotification(adminIds, {
    type: NotificationType.FEEDBACK_SUBMITTED,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length, ...pushed };
};

const getAllNotifications = async ({
  page = 1,
  limit = 20,
}: {
  page?: number;
  limit?: number;
}) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Notification.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(),
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

const notifyNewLike = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  message?: string,
  isSuperLike?: boolean
) => {
  // Prevent self-notification
  if (String(receiverId) === String(senderId)) {
    return { inAppCount: 0, successCount: 0, failureCount: 0 };
  }

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = isSuperLike ? "New Super Like! 🌟" : "New Like!";
  let body = `${senderName || "Someone"} liked your profile.`;
  if (isSuperLike) {
    body = message 
      ? `${senderName || "Someone"} sent you a super like: "${message}"`
      : `${senderName || "Someone"} sent you a super like!`;
  }

  const data: INotificationData = {
    senderId,
    receiverId,
    message,
    isSuperLike: isSuperLike ? "true" : "false"
  };

  const saved = await createInApp(
    [receiverObjectId],
    NotificationType.NEW_LIKE,
    title,
    body,
    data
  );

  const pushed = await pushToUserIds([receiverObjectId], title, body, data);

  const io = getIo();
  io.to(`notification_${receiverId}`).emit("notification", {
    type: NotificationType.NEW_LIKE,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length, ...pushed };
};

const notifyNewMatch = async (
  user1Id: string,
  user2Id: string,
  matchId: string
) => {
  const user1ObjectId = new Types.ObjectId(user1Id);
  const user2ObjectId = new Types.ObjectId(user2Id);

  const title = "New Match!";
  const body = "You have a new match! Start chatting now.";

  const data: INotificationData = {
    matchId,
  };

  const userIds = [user1ObjectId, user2ObjectId];

  const saved = await createInApp(
    userIds,
    NotificationType.NEW_MATCH,
    title,
    body,
    data
  );

  const pushed = await pushToUserIds(userIds, title, body, data);

  const io = getIo();
  userIds.forEach((id) => {
    io.to(`notification_${id.toString()}`).emit("notification", {
      type: NotificationType.NEW_MATCH,
      title,
      body,
      data,
    });
  });

  return { inAppCount: saved.length, ...pushed };
};
const admin = require('firebase-admin');

const sendTestPush = async () => {
  // Hardcoded FCM token from your frontend
  const token = "c0B6k3_ARjWTolXR50hPcr:APA91bF8r1U9_X0G9bdNiJkCoE230edj5n3kIyjHJAdkljLFB4ZLVSKndXH0KWu4ILuLETbcz7mAqlElBadm5fsG8UoZywO2pShIsD7cITkmZnD7odPzgBA";

  const message = {
    notification: {
      title: "Test Push",
      body: "This is a test notification from NotificationService"
    },
    data: { test: "value" },
    token: token // Pass the token directly here
  };

  try {
    // Look for how your backend initializes firebase admin (commonly admin.messaging())
    // Note: Use `.send()` for a single token, or `.sendMulticast()` for an array of tokens
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

const notifyPostLiked = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  postId: string
) => {
  if (String(receiverId) === String(senderId)) return;

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = "Post Liked!";
  const body = `${senderName || "Someone"} liked your post.`;

  const data: INotificationData = {
    senderId,
    receiverId,
    postId,
  };

  const saved = await createInApp(
    [receiverObjectId],
    NotificationType.POST_LIKED,
    title,
    body,
    data
  );

  await pushToUserIds([receiverObjectId], title, body, data);

  const io = getIo();
  io.to(`notification_${receiverId}`).emit("notification", {
    type: NotificationType.POST_LIKED,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length };
};

const notifyPostCommented = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  postId: string
) => {
  if (String(receiverId) === String(senderId)) return;

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = "New Comment!";
  const body = `${senderName || "Someone"} commented on your post.`;

  const data: INotificationData = {
    senderId,
    receiverId,
    postId,
  };

  const saved = await createInApp(
    [receiverObjectId],
    NotificationType.POST_COMMENTED,
    title,
    body,
    data
  );

  await pushToUserIds([receiverObjectId], title, body, data);

  const io = getIo();
  io.to(`notification_${receiverId}`).emit("notification", {
    type: NotificationType.POST_COMMENTED,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length };
};

const notifyCommentLiked = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  postId: string,
  commentId: string,
) => {
  if (String(receiverId) === String(senderId)) return;

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = "Comment Liked!";
  const body = `${senderName || "Someone"} liked your comment.`;

  const data: INotificationData = {
    senderId,
    receiverId,
    postId,
    commentId,
  };

  const saved = await createInApp(
    [receiverObjectId],
    NotificationType.COMMENT_LIKED,
    title,
    body,
    data,
  );

  await pushToUserIds([receiverObjectId], title, body, data);

  const io = getIo();
  io.to(`notification_${receiverId}`).emit("notification", {
    type: NotificationType.COMMENT_LIKED,
    title,
    body,
    data,
  });

  return { inAppCount: saved.length };
};

const BADGE_EARNED_MESSAGES: Record<ClubhouseBadge, { title: string; body: string }> = {
  [ClubhouseBadge.RISING_STAR]: {
    title: "Rising Star",
    body: "You're now a Rising Star ⭐Check out your first badge!",
  },
  [ClubhouseBadge.LOCAL_LEGEND]: {
    title: "Local Legend",
    body: "You're now a Local Legend ⛳️Check our your new badge!",
  },
  [ClubhouseBadge.CLUBHOUSE_CHAMPION]: {
    title: "Clubhouse Champion",
    body: "You're now a Clubhouse Champion🏆 Check out your trophy badge!",
  },
};

const notifyBadgeEarned = async (userId: string, badge: ClubhouseBadge) => {
  const msg = BADGE_EARNED_MESSAGES[badge];
  if (!msg) return;

  const receiverObjectId = new Types.ObjectId(userId);
  const data: INotificationData = { badge };

  const saved = await createInApp([receiverObjectId], NotificationType.BADGE_EARNED, msg.title, msg.body, data);
  await pushToUserIds([receiverObjectId], msg.title, msg.body, data);
  emitNotification([receiverObjectId], { type: NotificationType.BADGE_EARNED, title: msg.title, body: msg.body, data });

  return { inAppCount: saved.length };
};

const BADGE_PROXIMITY_MESSAGES: Record<ClubhouseBadge, string> = {
  [ClubhouseBadge.RISING_STAR]:
    "Your Rising Star badge is just around the corner. A little more activity gets you there!⛳️",
  [ClubhouseBadge.LOCAL_LEGEND]:
    "Your Local Legend badge is just around the corner. A little more activity gets you there!⛳️",
  [ClubhouseBadge.CLUBHOUSE_CHAMPION]:
    "Your Clubhouse Champion badge is just around the corner. A little more activity gets you there!⛳️",
};

const notifyBadgeProximity = async (userId: string, targetBadge: ClubhouseBadge) => {
  const body = BADGE_PROXIMITY_MESSAGES[targetBadge];
  if (!body) return;

  const title = "Badge within reach!";
  const receiverObjectId = new Types.ObjectId(userId);
  const data: INotificationData = { targetBadge };

  const saved = await createInApp([receiverObjectId], NotificationType.BADGE_PROXIMITY, title, body, data);
  await pushToUserIds([receiverObjectId], title, body, data);
  emitNotification([receiverObjectId], { type: NotificationType.BADGE_PROXIMITY, title, body, data });

  return { inAppCount: saved.length };
};

/**
 * Send an inactivity or badge-downgrade-warning notification.
 * Caller is responsible for rate-limit checks before calling this.
 */
const notifyClubhouseSystem = async (
  userId: string,
  type: NotificationType.CLUBHOUSE_INACTIVITY | NotificationType.BADGE_DOWNGRADE_WARNING,
  title: string,
  body: string,
  data?: INotificationData,
) => {
  const receiverObjectId = new Types.ObjectId(userId);

  const saved = await createInApp([receiverObjectId], type, title, body, data);
  await pushToUserIds([receiverObjectId], title, body, data);
  emitNotification([receiverObjectId], { type, title, body, data });

  return { inAppCount: saved.length };
};

export const NotificationService = {
  notifyAdminsFeedbackSubmitted,
  notifyChatMessage,
  getMyNotifications,
  markAsRead,
  markAllRead,
  deleteNotification,
  getAllNotifications,
  notifyNewLike,
  notifyNewMatch,
  notifyPostLiked,
  notifyPostCommented,
  notifyCommentLiked,
  sendTestPush,
  notifyBadgeEarned,
  notifyBadgeProximity,
  notifyClubhouseSystem,
};
