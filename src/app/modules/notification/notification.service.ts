/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import User from "../user/user.model";
import { Role } from "../user/user.interface";
import { Notification } from "./notification.model";
import { INotificationData, NotificationType } from "./notification.interface";
import { getIo } from "../socket/socket.store";
import { sendPushToTokens } from "../../utils/sendPushNotification";

const NOTI_ROOM = (userId: string) => `notification_${userId}`;

//  socket emit to notification room
const emitNotification = ( userIds: (string | Types.ObjectId)[],payload: any,) => {
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
  const users = await User.find({ _id: { $in: userIds } }).select("fcmTokens");
  const tokens = users.flatMap((u: any) => u.fcmTokens || []).filter(Boolean);

  if (!tokens.length) return { successCount: 0, failureCount: 0 };

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
  const body = `${sender?.full_name || "Someone"} sent you a message`;

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
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;

  const userObjectId = new Types.ObjectId(userId); // ✅ convert to ObjectId

  const [data, total] = await Promise.all([
    Notification.find({ user: userObjectId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ user: userObjectId }),
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
  senderName: string
) => {
  // Prevent self-notification
  if (String(receiverId) === String(senderId)) {
    return { inAppCount: 0, successCount: 0, failureCount: 0 };
  }

  const receiverObjectId = new Types.ObjectId(receiverId);

  const title = "New Like!";
  const body = `${senderName || "Someone"} liked your profile.`;

  const data: INotificationData = {
    senderId,
    receiverId,
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
};
