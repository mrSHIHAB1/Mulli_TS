import mongoose from "mongoose";
import http from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { connectRedis } from "./app/config/redis.config";
import { initFirebase } from "./app/config/firebase.config";
import { setIo } from "./app/modules/socket/socket.store";
import { initSockets } from "./app/modules/socket/socket";
import { Server as SocketIoServer } from "socket.io";

initFirebase();


let server: http.Server;

server = http.createServer(app);

const io = new SocketIoServer(server, {
  cors: {
    origin: ["http://localhost:3000","http://localhost:5173","http://localhost:5174"],
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
