// app/modules/chat/chat.socket.ts
import { Server, Socket } from "socket.io";

export const chatSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(" [Chat] client connected:", socket.id);

    // ✅ Join only own personal room
    socket.on("join-chat", (userId: string) => {
      if (!userId) return;

      socket.join(userId);
      console.log(` ${socket.id} joined personal room: ${userId}`);
    });

    socket.on("leave-chat", (userId: string) => {
      if (!userId) return;

      socket.leave(userId);
      console.log(`🚪 ${socket.id} left room: ${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(" [Chat] disconnected:", socket.id);
    });
  });
};
