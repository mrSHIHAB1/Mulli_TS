import IORedis from "ioredis";
import { envVars } from "./env";

/**
 * Dedicated Redis connection for BullMQ.
 * MUST NOT be shared with the main app Redis client.
 * BullMQ requires maxmemory-policy = noeviction.
 */
export const bullmqRedis = new IORedis({
  host: envVars.REDIS_HOST!,
  port: Number(envVars.REDIS_PORT),
  username: envVars.REDIS_USERNAME,
  password: envVars.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,    // required by BullMQ
});

bullmqRedis.on("error", (err) => {
  console.error("[BullMQ Redis] Connection error:", err.message);
});

/**
 * Call this once at server startup to enforce noeviction policy.
 * BullMQ will log warnings if the policy is volatile-lru or any other eviction mode.
 */
export const ensureBullMQRedisPolicy = async () => {
  try {
    await bullmqRedis.config("SET", "maxmemory-policy", "noeviction");
    console.log("[BullMQ] Redis maxmemory-policy set to noeviction");
  } catch (err: any) {
    console.warn("[BullMQ] Could not set maxmemory-policy (may need Redis admin rights):", err.message);
  }
};

/**
 * BullMQ accepts an IORedis instance directly as the connection.
 */
export const bullmqConnection = bullmqRedis;
