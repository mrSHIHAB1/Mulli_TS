/**
 * Subscription Plans Configuration
 * Defines all available subscription tiers with pricing and features
 */

export enum Plan {
  BIRDIE = "BIRDIE",
  EAGLE = "EAGLE",
  ACE = "ACE",
  FREE = "FREE",
}

export interface PlanFeatures {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxMatches?: number;
  maxMessages?: number;
  premiumFeatures: string[];
}

export const SUBSCRIPTION_PLANS: Record<Plan, PlanFeatures> = {
  [Plan.BIRDIE]: {
    name: "BIRDIE",
    description: "Good for casual dating",
    monthlyPrice: 9.99,
    yearlyPrice: 89.99,
    features: [
      "See who likes you",
      "Unlimited matches",
      "Basic messaging",
    ],
    maxMatches: -1, // unlimited
    maxMessages: -1,
    premiumFeatures: ["See likes"],
  },
  [Plan.EAGLE]: {
    name: "EAGLE",
    description: "For serious connections",
    monthlyPrice: 19.99,
    yearlyPrice: 179.99,
    features: [
      "Everything in Plus",
      "Priority messaging",
      "See mutual interests",
      "VIP profile boost",
    ],
    maxMatches: -1,
    maxMessages: -1,
    premiumFeatures: ["Priority messaging", "Mutual interests", "Profile boost"],
  },
  [Plan.ACE]: {
    name: "ACE",
    description: "For women seeking premium experience",
    monthlyPrice: 14.99,
    yearlyPrice: 129.99,
    features: [
      "Everything in Plus",
      "Women-only networking",
      "Event access",
      "Chat verification badge",
    ],
    maxMatches: -1,
    maxMessages: -1,
    premiumFeatures: ["Women networking", "Event access", "Verification badge"],
  },
  [Plan.FREE]: {
    name: "FREE",
    description: "Limited features for basic users",
    monthlyPrice: 0,
    yearlyPrice: 0  ,
    features: [
      "Everything in X & Bridie",
      "Concierge support",
      "Advanced filters",
      "Unlimited super likes",
      "Travel mode",
      "Rewind (undo swipes)",
    ],
    maxMatches: -1,
    maxMessages: -1,
    premiumFeatures: [
      "Concierge support",
      "Advanced filters",
      "Super likes",
      "Travel mode",
      "Rewind",
    ],
  },
};

/**
 * Durations mapping iOS product IDs
 * Format: [plan]_[duration]
 */
export const PRODUCT_DURATION_MAP: Record<string, "1m" | "3m" | "1y"> = {
  "mulli_plus_1m": "1m",
  "mulli_plus_3m": "3m",
  "mulli_plus_1y": "1y",
  "mulli_x_1m": "1m",
  "mulli_x_3m": "3m",
  "mulli_x_1y": "1y",
  "mulli_bridie_1m": "1m",
  "mulli_bridie_3m": "3m",
  "mulli_bridie_1y": "1y",
  "mulli_ace_1m": "1m",
  "mulli_ace_3m": "3m",
  "mulli_ace_1y": "1y",
};

export const getDurationInDays = (duration: "1m" | "3m" | "1y"): number => {
  const map = {
    "1m": 30,
    "3m": 90,
    "1y": 365,
  };
  return map[duration];
};

export const getDurationLabel = (duration: "1m" | "3m" | "1y"): string => {
  const map = {
    "1m": "1 Month",
    "3m": "3 Months",
    "1y": "1 Year",
  };
  return map[duration];
};
