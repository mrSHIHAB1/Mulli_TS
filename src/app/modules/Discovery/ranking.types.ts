/**
 * Type definitions for the ranking and discovery system
 */

export type BucketType = "A" | "B" | "C";
export type ModeType = "buddy" | "date";
export type TrustScoreStatus = "RED" | "ORANGE" | "GREEN";
export type BoostType = "MANUAL" | "SUBSCRIPTION" | null;

/**
 * Scoring interfaces
 */
export interface IScores {
  buddyCompatibilityScore: number;
  buddyDesireScore: number;
  dateCompatibilityScore: number;
  dateDesireScore: number;
}

export interface IBaseScore {
  mode: ModeType;
  score: number;
  compatibilityScore: number;
  desireScore: number;
}

/**
 * Bucket interfaces
 */
export interface IBucketAssignment {
  userId: string;
  baseScore: number;
  bucket: BucketType;
  mode: ModeType;
}

export interface IBucketDistribution {
  A: number;
  B: number;
  C: number;
}

export interface IBucketThresholds {
  aMin: number;
  bMin: number;
  cMin: number;
}

/**
 * Score modifier interfaces
 */
export interface IScoreModifiers {
  trustScore: TrustScoreStatus;
  isBoosted: boolean;
  baseScore: number;
  finalScore: number;
}

/**
 * New user interfaces
 */
export interface INewUserWindow {
  isNewUser: boolean;
  signedUpAt?: Date | null;
  newUserWindowExpiresAt?: Date | null;
}

export interface INewUserStatus {
  isNewUser: boolean;
  remainingHours: number;
  expiresAt?: Date;
}

/**
 * Swipe deck interfaces
 */
export interface IUserWithScore {
  _id: string;
  firstName: string;
  lastName: string;
  age: number;
  profileImage: string;
  images: string[];
  gender: string;
  distanceKm: number;
  skillLevel: string;
  hopingToFind: string;
  playstyle: string;
  bucket: BucketType;
  baseScore: number;
  finalScore: number;
  isNewUser: boolean;
  trustScore: TrustScoreStatus;
  isBoosted: boolean;
}

export interface ISwipeDeck {
  users: IUserWithScore[];
  pagination: {
    total: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
  metadata: {
    bucketDistribution: IBucketDistribution;
    newUsersIncluded: number;
    averageScore: number;
  };
}

/**
 * Spacing validation interfaces
 */
export interface ISpacingValidation {
  isValid: boolean;
  violations: string[];
}

/**
 * Score metadata
 */
export interface IScoreMetadata {
  matchRate: number;
  likeRate: number;
  totalLikesReceived: number;
  totalSwipesReceived: number;
  lastScoreCalculation?: Date | null;
}

/**
 * Discovery filter interfaces
 */
export interface IDiscoveryFilters {
  gender?: string;
  minAge?: number;
  maxAge?: number;
  minDistance?: number;
  maxDistance?: number;
  minPhotos?: number;
  hasBio?: boolean;
  minHeight?: number;
  maxHeight?: number;
  ethnicity?: string;
  politics?: string;
  religion?: string;
  interests?: string[];
  openTo?: string;
  languages?: string[];
  hopingToFind?: string;
  dealBreaker?: boolean; // Override all scores
}

/**
 * Discovery response
 */
export interface IDiscoveryResponse {
  users: any[];
  pagination: {
    total: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
  metadata?: {
    bucketDistribution: IBucketDistribution;
    newUsersIncluded: number;
    averageScore: number;
  };
}

/**
 * Admin/Maintenance interfaces
 */
export interface IVerifyBucketsResult {
  processed: number;
  fixed: number;
}

export interface IBucketRecalcResult {
  totalUsers: number;
  bucketA: number;
  bucketB: number;
  bucketC: number;
  timestamp: Date;
}

/**
 * Compatibility score calculation results
 */
export interface ICompatibilityResult {
  skillMatch: number;
  styleMatch: number;
  vibeMatch: number;
  intentMatch: number;
  homeCourseMatch: number;
  locationScore: number;
  finalScore: number;
}

export interface IDatingCompatibilityResult {
  skillMatch: number;
  intentMatch: number;
  lifestyleMatch: number;
  locationScore: number;
  finalScore: number;
}

/**
 * Desire score calculation results
 */
export interface IDesireScoreResult {
  matchRate: number;
  likeRate: number;
  finalScore: number;
}

/**
 * Final score components
 */
export interface IFinalScoreComponents {
  baseScore: number;
  trustModifier: number;
  boostModifier: number;
  finalScore: number;
  breakdown: {
    compatibilityScore: number;
    desireScore: number;
    trustPenalty: number;
    boostBonus: number;
  };
}
