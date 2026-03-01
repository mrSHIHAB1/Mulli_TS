import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { notificationSocket } from "./notification.socket";

export const initSockets = (io: Server) => {
  chatSocket(io);
  notificationSocket(io);
};
