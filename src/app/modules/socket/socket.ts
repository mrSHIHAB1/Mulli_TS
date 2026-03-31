import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { notificationSocket } from "./notification.socket";
import { userStatusSocket } from "./userStatus.socket";

export const initSockets = (io: Server) => {
  chatSocket(io);
  notificationSocket(io);
  userStatusSocket(io);
};
