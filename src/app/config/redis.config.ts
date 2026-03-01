import Redis from "ioredis";
import { envVars } from "./env";


export const redisClient = new Redis({
  host: envVars.REDIS_HOST,
  port: Number(envVars.REDIS_PORT),
  username: envVars.REDIS_USERNAME,
  password: envVars.REDIS_PASSWORD,
});

redisClient.on("ready", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

/**
 * Connect Redis ONCE
 */
export const connectRedis = async () => {
  if (redisClient.status === "ready") return;

  if (redisClient.status === "end") {
    await redisClient.connect();
  }

  if (redisClient.status === "connecting") {
    await new Promise((resolve) =>
      redisClient.once("ready", resolve)
    );
  }
};
