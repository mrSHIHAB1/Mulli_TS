import { Server, Socket } from "socket.io";
import { userService } from "../user/user.service";

export const userStatusSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    
    // When user enters the app and provides their ID
    socket.on("user-online", async (userId: string) => {
      if (!userId) return;
      
      // Store userId in socket object to use on disconnect
      socket.data.userId = userId;
      
      // Mark user as online in database
      await userService.updateUserStatus(userId, true);
      
      // Notify others or log
      console.log(`User ${userId} is online`);
      
      // Broadcast to others if needed
      io.emit("user-status-changed", { userId, isOnline: true });
    });

    // When user leaves the app or disconnects
    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      if (userId) {
        // Mark user as offline in database
        await userService.updateUserStatus(userId, false);
        
        console.log(`User ${userId} is offline`);
        
        // Broadcast to others if needed
        io.emit("user-status-changed", { userId, isOnline: false });
      }
    });

    // Optional: handle manual "go offline" if the app has a toggle
    socket.on("user-offline", async (userId: string) => {
      if (!userId) return;
      await userService.updateUserStatus(userId, false);
      io.emit("user-status-changed", { userId, isOnline: false });
    });
  });
};
