import mongoose from "mongoose";
import http from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { connectRedis } from "./app/config/redis.config";
import { setIo } from "./app/modules/socket/socket.store";
import { initSockets } from "./app/modules/socket/socket";
import { Server as SocketIoServer } from "socket.io";

let server: http.Server;

server = http.createServer(app);

const io = new SocketIoServer(server, {
  cors: {
    origin: ["http://localhost:3000","http://localhost:5173"],
    credentials: true,
  },
});

setIo(io);
initSockets(io);

const startServer = async () => {
  try {
    await connectRedis();
    await mongoose.connect(envVars.DB_URL);
    console.log("Connected to Database");

    server.listen(envVars.PORT, () => {
      console.log(`Server is listening on port ${envVars.PORT}`);
    });

  } catch (error) {
    console.log(error);
  }
};

(async () => {
  await startServer();
})();
