import { Server, Socket } from "socket.io";

export const notificationSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(" [Notification] client connected:", socket.id);

    socket.on("join-notification", (userId: string) => {
      socket.join(`notification_${userId}`);
      console.log(` ${socket.id} joined room: notification_${userId}`);
    });

    socket.on("leave-notification", (userId: string) => {
      socket.leave(`notification_${userId}`);
      console.log(`🚪 ${socket.id} left room: notification_${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(" [Notification] disconnected:", socket.id);
    });
  });
};
