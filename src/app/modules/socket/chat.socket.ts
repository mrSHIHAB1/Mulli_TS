// app/modules/chat/chat.socket.ts
import { Server, Socket } from "socket.io";

export const chatSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {

    socket.on("join-chat", (userId: string) => {
      if (!userId) return;
      socket.join(userId);
      socket.data.userId = userId; // Ensure userId is tracked for focus checks
    });

    socket.on("leave-chat", (userId: string) => {
      if (!userId) return;
      socket.leave(userId);
    });

    socket.on("focus-chat", (otherUserId: string) => {
      if (!otherUserId) return;
      socket.data.focusedChat = otherUserId;
    });

    socket.on("unfocus-chat", () => {
      socket.data.focusedChat = null;
    });

    socket.on("disconnect", () => {
    });
  });
};
