import mongoose from "mongoose";
import http from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { connectRedis } from "./app/config/redis.config";
import { initFirebase } from "./app/config/firebase.config";
import { setIo } from "./app/modules/socket/socket.store";
import { initSockets } from "./app/modules/socket/socket";
import { Server as SocketIoServer } from "socket.io";
// import { closeAllWorkers } from "./app/workers";
// import { ensureBullMQRedisPolicy } from "./app/config/bullmq.config";

initFirebase();


let server: http.Server;

server = http.createServer(app);

const io = new SocketIoServer(server, {
  cors: {
    origin: "*", // allow all origins
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
    // await ensureBullMQRedisPolicy();

    server.listen(envVars.PORT, () => {
      console.log(`Server is listening on port ${envVars.PORT}`);
      // console.log("[BullMQ] Workers started");
    });

  } catch (error) {
    console.log(error);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  // await closeAllWorkers();
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  await startServer();
})();
