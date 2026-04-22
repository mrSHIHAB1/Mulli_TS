// app/modules/chat/chat.socket.ts
import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { Message } from "../chat/chat.model";
import { MessageStatus } from "../chat/chat.interface";

const emitUnreadCounts = async (io: Server, receiverId: string, senderId?: string) => {
  if (!Types.ObjectId.isValid(receiverId)) return;

  const receiverObjId = new Types.ObjectId(receiverId);

  const totalUnreadUsersList = await Message.distinct("sender", {
    receiver: receiverObjId,
    status: { $ne: MessageStatus.SEEN },
  });

  const payload: {
    totalUnreadUsers: number;
    unreadCount?: number;
    senderId?: string;
  } = {
    totalUnreadUsers: totalUnreadUsersList.length,
  };

  if (senderId && Types.ObjectId.isValid(senderId)) {
    payload.unreadCount = await Message.countDocuments({
      receiver: receiverObjId,
      sender: new Types.ObjectId(senderId),
      status: { $ne: MessageStatus.SEEN },
    });
    payload.senderId = senderId;
  }

  io.to(receiverId).emit("unread_count_update", payload);
};

export const chatSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    socket.on("user-online", async (userId: string) => {
      if (!userId || !Types.ObjectId.isValid(userId)) return;

      // Join personal room at app entry so unread updates work app-wide.
      socket.join(userId);
      socket.data.userId = userId;

      await emitUnreadCounts(io, userId);
    });

    socket.on("join-chat", async (userId: string) => {
      if (!userId || !Types.ObjectId.isValid(userId)) return;
      socket.join(userId);
      socket.data.userId = userId; // Ensure userId is tracked for focus checks

      // Emit initial aggregate unread count for this connected client
      await emitUnreadCounts(io, userId);
    });

    socket.on("leave-chat", (userId: string) => {
      if (!userId) return;

      // Do not leave the personal room; it's needed for app-wide unread updates.
      if (socket.data.userId && socket.data.userId === userId) {
        socket.data.focusedChat = null;
        return;
      }

      socket.leave(userId);
    });

    socket.on("focus-chat", async (otherUserId: string) => {
      if (!otherUserId || !Types.ObjectId.isValid(otherUserId)) return;
      socket.data.focusedChat = otherUserId;

      const currentUserId = socket.data.userId as string | undefined;
      if (!currentUserId || !Types.ObjectId.isValid(currentUserId)) return;

      // If the user is actively chatting with someone, mark incoming unread messages as seen.
      await Message.updateMany(
        {
          sender: new Types.ObjectId(otherUserId),
          receiver: new Types.ObjectId(currentUserId),
          status: { $ne: MessageStatus.SEEN },
        },
        { $set: { status: MessageStatus.SEEN } },
      );

      await emitUnreadCounts(io, currentUserId, otherUserId);
    });

    socket.on("get-unread-count", async (senderId?: string) => {
      const currentUserId = socket.data.userId as string | undefined;
      if (!currentUserId || !Types.ObjectId.isValid(currentUserId)) return;

      if (senderId && !Types.ObjectId.isValid(senderId)) {
        await emitUnreadCounts(io, currentUserId);
        return;
      }

      await emitUnreadCounts(io, currentUserId, senderId);
    });

    socket.on("unfocus-chat", () => {
      socket.data.focusedChat = null;
    });

    socket.on("disconnect", () => {
    });
  });
};
