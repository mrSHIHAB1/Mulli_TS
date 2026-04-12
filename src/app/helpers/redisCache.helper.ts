import { redisClient } from "../config/redis.config";
import { ISubscription } from "../modules/subscription/subscription.interface";

const CACHE_TTL = 3600; // 1 hour

/**
 * Cache user subscription plan in Redis.
 */
export const cacheUserSubscription = async (
  userId: string,
  subscription: ISubscription | null
): Promise<void> => {
  try {
    const key = `user:${userId}:subscription`;
    await redisClient.setex(key, CACHE_TTL, JSON.stringify(subscription));
  } catch (error) {
    console.error("Error caching user subscription:", error);
  }
};

/**
 * Get cached user subscription from Redis.
 * Returns undefined on cache miss, null when the user has no subscription.
 */
export const getCachedUserSubscription = async (
  userId: string
): Promise<ISubscription | null | undefined> => {
  try {
    const key = `user:${userId}:subscription`;
    const cached = await redisClient.get(key);
    if (cached === null) return undefined; // cache miss
    return JSON.parse(cached) as ISubscription | null;
  } catch (error) {
    console.error("Error retrieving cached subscription:", error);
    return undefined;
  }
};

/**
 * Invalidate user subscription cache in Redis.
 */
export const invalidateUserSubscriptionCache = async (
  userId: string
): Promise<void> => {
  try {
    const key = `user:${userId}:subscription`;
    await redisClient.del(key);
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
};
