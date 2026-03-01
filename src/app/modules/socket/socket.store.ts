import { Server } from "socket.io";

let io: Server;

export const setIo = (server: Server) => {
  io = server;
};

export const getIo = (): Server => {
  if (!io) throw new Error("❌ Socket.io not initialized");
  return io;
};
