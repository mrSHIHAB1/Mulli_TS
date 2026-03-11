/* eslint-disable @typescript-eslint/no-explicit-any */
import { JwtPayload } from "jsonwebtoken";
import { getIo } from "../socket/socket.store";
import User from "../user/user.model";
import { IMessage, MessageStatus } from "./chat.interface";
import { NotificationService } from "../notification/notification.service";
import { Types } from "mongoose";
import AppError from "../../errorHelpers/AppError";
import { Message } from "./chat.model";
import { formatChatTime } from "../../utils/timeFormatter";
import { fileUploader } from "../../helpers/fileUpload";

const sendMessageService = async (
  user: JwtPayload,
  receiverId: string,
  payload: Partial<IMessage>,
) => {
  const senderId = user.userId || user.id;

  // Block sending message to self
  if (String(senderId) === String(receiverId)) {
    throw new AppError(400, "Cannot send message to yourself");
  }


  const [senderUser, receiverUser] = await Promise.all([
    User.findById(senderId).select("_id firstName lastName"), 
    User.findById(receiverId).select("_id firstName lastName"),
  ]);

  if (!senderUser) throw new AppError(401, "Invalid sender");
  if (!receiverUser) throw new AppError(404, "Receiver not found");


  // Create message document
  const messageDoc = await Message.create({
    sender: new Types.ObjectId(senderId),
    receiver: new Types.ObjectId(receiverId),
    message: {
      text: payload.message?.text || "",
       media: payload.message?.media || [], 
    },
    status: payload.status || MessageStatus.SENT,
    replyTo: payload.replyTo,
  });

  const io = getIo();

  // Emit only to receiver room
  io.to(String(receiverId)).emit("message", messageDoc);

  // Notify receiver
  await NotificationService.notifyChatMessage(
    receiverId,
    senderUser,
    messageDoc,
  );

  return messageDoc;
};

const getConversationsService = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.userId || user.id);
  console.log("User ID in getConversationsService:", userId);
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: userId }, { receiver: userId }],
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$sender", userId] },
            "$receiver",
            "$sender",
          ],
        },
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiver", userId] },
                  { $ne: ["$status", MessageStatus.SEEN] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        user: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          profileImage: 1,
        },
        lastMessage: 1,
        unreadCount: 1,
      },
    },
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
  ]);
  const formattedConversations = conversations.map((conv) => ({
    ...conv,
    lastMessage: {
      ...conv.lastMessage,
      timeLabel: formatChatTime(conv.lastMessage.createdAt),
    },
  }));

  return formattedConversations;

  
};

const getMessagesService = async (user: JwtPayload, otherUserId: string) => {
  const userId = user.userId || user.id;

  const messages = await Message.find({
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  })
    .populate("sender", "full_name email profile_picture")
    .populate("receiver", "full_name email profile_picture")
    .populate({
      path: "replyTo",
      populate: { path: "sender", select: "full_name email" },
    })
    .sort({ createdAt: 1 });

  return messages;
};
const deleteMessageService = async (user: JwtPayload, messageId: string) => {
  const senderId = user.userId || user.id;

  const message = await Message.findById(messageId);

  if (!message) throw new AppError(404, "Message not found");

  if (String(message.sender) !== String(senderId)) {
    throw new AppError(403, "You can only delete your own messages");
  }

  // Delete all media from Cloudinary
  if (message.message?.media && message.message.media.length > 0) {
    await Promise.all(
      message.message.media.map(async (item) => {
        // Extracts "folder/filename" from full cloudinary URL
        const matches = item.url.match(/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
        const publicId = matches ? matches[1] : "";

        if (publicId) {
          const resourceType = item.type === "image" ? "image" : "video"; // cloudinary uses "video" for audio too
          await fileUploader.deleteFromCloudinary(publicId, resourceType);
        }
      })
    );
  }

  // Hard delete from DB
  await Message.findByIdAndDelete(messageId);

  // Notify receiver in real-time
  const io = getIo();
  io.to(String(message.receiver)).emit("message_deleted", { messageId });

  return { messageId };
};

// Add to exports
export const chatService = {
  sendMessageService,
  getConversationsService,
  getMessagesService,
  deleteMessageService, // ← add
};

