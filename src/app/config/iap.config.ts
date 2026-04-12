import { Plan } from "../modules/subscription/subscription.interface";
import { PRODUCT_DURATION_MAP } from "./subscriptionPlans";

export const PRODUCT_PLAN_MAP: Record<string, Plan> = {
  // BIRDIE
  "mulli_birdie_1m": Plan.BIRDIE,
  "mulli_birdie_3m": Plan.BIRDIE,


  // EAGLE
  "mulli_eagle_1m": Plan.EAGLE,
  "mulli_eagle_3m": Plan.EAGLE,



  // MULLI ACE
  "mulli_ace_1m": Plan.ACE,
  "mulli_ace_3m": Plan.ACE,
  
};

export const VALID_PRODUCT_IDS = Object.keys(PRODUCT_PLAN_MAP);

/**
 * Extract plan from product ID
 * @example "mulli_birdie_1m" -> Plan.BIRDIE
 */
export const extractPlanFromProductId = (productId: string): Plan | null => {
  return PRODUCT_PLAN_MAP[productId] || null;
};

/**
 * Get product IDs for a specific plan
 * @example Plan.BIRDIE -> ["mulli_birdie_1m", "mulli_birdie_3m", "mulli_birdie_1y"]
 */
export const getProductIdsForPlan = (plan: Plan): string[] => {
  return Object.entries(PRODUCT_PLAN_MAP)
    .filter(([_, planValue]) => planValue === plan)
    .map(([productId]) => productId);
};

