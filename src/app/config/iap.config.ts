import { Plan } from "../modules/subscription/subscription.interface";
import { PRODUCT_DURATION_MAP } from "./subscriptionPlans";

export const PRODUCT_PLAN_MAP: Record<string, Plan> = {
  // MULLI PLUS
  "mulli_plus_1m": Plan.MULLI_PLUS,
  "mulli_plus_3m": Plan.MULLI_PLUS,
  "mulli_plus_1y": Plan.MULLI_PLUS,

  // MULLI X
  "mulli_x_1m": Plan.MULLI_X,
  "mulli_x_3m": Plan.MULLI_X,
  "mulli_x_1y": Plan.MULLI_X,

  // MULLI BRIDIE
  "mulli_bridie_1m": Plan.MULLI_BRIDIE,
  "mulli_bridie_3m": Plan.MULLI_BRIDIE,
  "mulli_bridie_1y": Plan.MULLI_BRIDIE,

  // MULLI ACE
  "mulli_ace_1m": Plan.MULLI_ACE,
  "mulli_ace_3m": Plan.MULLI_ACE,
  "mulli_ace_1y": Plan.MULLI_ACE,
};

export const VALID_PRODUCT_IDS = Object.keys(PRODUCT_PLAN_MAP);

/**
 * Extract plan from product ID
 * @example "mulli_plus_1m" -> Plan.MULLI_PLUS
 */
export const extractPlanFromProductId = (productId: string): Plan | null => {
  return PRODUCT_PLAN_MAP[productId] || null;
};

/**
 * Get product IDs for a specific plan
 * @example Plan.MULLI_PLUS -> ["mulli_plus_1m", "mulli_plus_3m", "mulli_plus_1y"]
 */
export const getProductIdsForPlan = (plan: Plan): string[] => {
  return Object.entries(PRODUCT_PLAN_MAP)
    .filter(([_, planValue]) => planValue === plan)
    .map(([productId]) => productId);
};