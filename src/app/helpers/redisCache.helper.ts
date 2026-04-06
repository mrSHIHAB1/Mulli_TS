import { redisClient } from "../config/redis.config";
import { ISubscription } from "../modules/subscription/subscription.interface";

const CACHE_TTL = 3600; // 1 hour

// Use a blazing fast local memory cache to completely mask Redis latency
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

/**
 * Cache user subscription plan
 */
export const cacheUserSubscription = async (
  userId: string,
  subscription: ISubscription | null
): Promise<void> => {
  try {
    const key = `user:${userId}:subscription`;
    
    // 1. Instant local memory cache (0ms latency)
    memoryCache.set(key, { value: subscription, expiresAt: Date.now() + (CACHE_TTL * 1000) });
    
    // 2. Fire and forget to Redis
    redisClient.setex(key, CACHE_TTL, JSON.stringify(subscription)).catch(e => console.error("Redis set error", e));
  } catch (error) {
    console.error("Error caching user subscription:", error);
  }
};

/**
 * Get cached user subscription
 */
export const getCachedUserSubscription = async (
  userId: string
): Promise<ISubscription | null | undefined> => {
  try {
    const key = `user:${userId}:subscription`;
    
    // 1. Check ultra-fast local memory cache first
    const memCached = memoryCache.get(key);
    if (memCached && Date.now() < memCached.expiresAt) {
      return memCached.value;
    }
    
    // 2. Fallback to Redis if missing in memory (happens on app restart)
    const cached = await redisClient.get(key);
    if (cached === null) return undefined; // Cache miss
    
    const parsed = JSON.parse(cached);
    // Sync to memory for next time
    memoryCache.set(key, { value: parsed, expiresAt: Date.now() + (CACHE_TTL * 1000) });
    
    return parsed;
  } catch (error) {
    console.error("Error retrieving cached subscription:", error);
    return undefined;
  }
};

/**
 * Invalidate user subscription cache
 */
export const invalidateUserSubscriptionCache = async (
  userId: string
): Promise<void> => {
  try {
    const key = `user:${userId}:subscription`;
    
    // Clear instantly from memory
    memoryCache.delete(key);
    
    // Fire and forget invalidation from Redis
    redisClient.del(key).catch(e => console.error("Redis del error", e));
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
};
