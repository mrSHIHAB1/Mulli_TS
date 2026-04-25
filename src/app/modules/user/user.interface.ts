// Core user-related TypeScript types & enums
// Used across auth middleware, passport config, and user tokens

import { Types } from "mongoose";

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",

}

export enum IsActive {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
}

export enum AuthProviderType {
  GOOGLE = "google",
  APPLE = "apple",
  LOCAL = "local",
}

export interface IAuthProvider {
  provider: AuthProviderType;
  providerID: string;
}
export enum Line{
ONTHECOURSE = "ONTHECOURSE",
OFFTHECOURSE = "OFFTHECOURSE",
  DATING = "DATING",
}
// This should reflect the fields we actually use in services, auth, and passport.
// It's intentionally permissive (many fields optional) to avoid blocking on strict typing.
export enum ClubhouseStatus {
  IN_CLUBHOUSE = "In the Clubhouse",
  COOLING_DOWN = "Cooling Down",
  CHECKED_OUT = "Checked Out",
}

export enum ClubhouseBadge {
  CLUBHOUSE_CHAMPION = "Clubhouse Champion",
  LOCAL_LEGEND = "Local Legend",
  RISING_STAR = "Rising Star",
}



export enum moreAboutGender {
  INTERSEX_MEN = "INTERSEX_MEN",
  TRANSWOMEN = "TRANSWOMEN",
  CIS_WOMEN = "CIS_WOMEN",
 TRANSFEMINIE= "TRANSFEMINIE",
  MEN_AND_NON_BINARY = "ME_AND_NON_BINARY",

}
export enum Politics {
  LIBERAL = "LIBERAL",
  CONSERVATIVE = "CONSERVATIVE",
  MODERATE = "MODERATE",
  APOLITICAL = "APOLITICAL",
  OTHER = "OTHER",
}

export enum Zodiac {
  ARIES = "ARIES",
  TAURUS = "TAURUS",
  GEMINI = "GEMINI",
  CANCER = "CANCER",
  LEO = "LEO",
  VIRGO = "VIRGO",
  LIBRA = "LIBRA",
  SCORPIO = "SCORPIO",
  SAGITTARIUS = "SAGITTARIUS",
  CAPRICORN = "CAPRICORN",
  AQUARIUS = "AQUARIUS",
  PISCES = "PISCES",
}
export enum EducationPlan {
  NOT_STUDYING = "NOT_STUDYING",
  UNDERGRADUATE = "UNDERGRADUATE",
  GRADUATE = "GRADUATE",
  PHD = "PHD",
  PROFESSIONAL_CERTIFICATION = "PROFESSIONAL_CERTIFICATION",
  SELF_LEARNING = "SELF_LEARNING",
}
export enum CommunicationStyle {
  DIRECT = "DIRECT",
  FRIENDLY = "FRIENDLY",
  DEEP = "DEEP",
  FUNNY = "FUNNY",
  RESERVED = "RESERVED",
}
export enum LoveLanguage {
  WORDS_OF_AFFIRMATION = "WORDS_OF_AFFIRMATION",
  ACTS_OF_SERVICE = "ACTS_OF_SERVICE",
  RECEIVING_GIFTS = "RECEIVING_GIFTS",
  QUALITY_TIME = "QUALITY_TIME",
  PHYSICAL_TOUCH = "PHYSICAL_TOUCH",
}
export enum CannabisUsage {
  NEVER = "NEVER",
  OCCASIONALLY = "OCCASIONALLY",
  SOCIALLY = "SOCIALLY",
  REGULARLY = "REGULARLY",
  PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY",
}
export enum Workout {
  NEVER = "NEVER",
  SOMETIMES = "SOMETIMES",
  REGULARLY = "REGULARLY",
  GYM_LOVER = "GYM_LOVER",
  OUTDOOR = "OUTDOOR",
}
export enum PetType {
  DOG = "DOG",
  CAT = "CAT",
  NONE = "NONE",
  OTHER = "OTHER",
}
export enum Language{
  ENGLISH = "ENGLISH",
  SPANISH = "SPANISH",
  FRENCH = "FRENCH",
  MANDARIN = "MANDARIN",
  HINDI = "HINDI",
  ARABIC = "ARABIC",
  BENGALI = "BENGALI",
  PORTUGUESE = "PORTUGUESE",
  RUSSIAN = "RUSSIAN",
  JAPANESE = "JAPANESE",
  OTHER = "OTHER",
}
export interface IDailyClubhouseStats {
  date: Date;
  givenPoints: number;
  postsCreated: number;
  bonusPostsAwarded: number;
  likesGiven: number;
  strongReactionsGiven: number;
  commentsGiven: number;
  reentryPoints: number;
}

export interface IBadgeProximityNotified {
  risingstar: boolean;
  locallegend: boolean;
  clubhousechampion: boolean;
}

export interface ILinePrompt {
  text: string;
  description: string;
}

export interface ILineItem {
  type: Line;
  prompts: ILinePrompt[];
}


export interface IUser {
  _id?: Types.ObjectId;
  email?: string;
  phone?: string;
  password?: string;
  role: Role;
  isActive?: IsActive;
  isDeleted?: boolean;
  isVerified?: boolean;
  isblocked?: boolean;
  isOnline?: boolean;
  auth_providers?: IAuthProvider[];

  // Profile flags
  shareEmail?: boolean;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  isProfileComplete?: boolean;

  // Names
  name?: string;
  firstName?: string;
  lastName?: string;
  fcmTokens?: string[],
  // Misc fields used by the new dating/golf profile
  birthdate?: Date;
  trackactivity?: "Once" | "While_Using" | "No";
  gender?: "Men" | "Women" | "Nonbinary" | "ALL";
  genderPreference?: "Men" | "Women" | "Nonbinary" | "ALL";
  hopingToFind?: "Long_Term" | "Short_Term" | "Casual" | "Ethical";
  ethnicity?: string;
  country?: string;
  religion?: string;
  skillLevel?:
  | "Beginner"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Expert";
  handicaprange?: {
    minRange?: number;
    maxRange?: number;
  };
  height?: number;
  hasKids?: boolean;
  wantsKids?: string;
  drinking?: string;
  smoking?: string;
  goodGolfBuddyQualities?: string[];
  preferredGolfTimes?: string;
  images?: string[];
  prompt?: string[];
  languages?: Language[];
  bio?: string;
  playstyle?: "Golf_Buddy" | "Golf_Date";
  location?: {
    type?: string;
    coordinates?: [number, number];
    placeName?: string;
  };
  useLocation?: boolean;
   vibe: {
    playStyles: string;     // multi-select
    pace: string;               // multi-select
    courseVibes: string;  // multi-select
  };

  play: {
    preferences: string; // walking, 9 holes etc.
    mentality: string;        // mindset
    socialStyle: string;    // group behavior
  };
  reciveNotifications?: boolean;
  preferredDistance?:Number;
  appleId: { type: String, index: true },
  provider: { type: String, enum: ["apple", "google", "phone", "email"] },
  profileImage?: string;
  enableFaceId?: boolean;
  badgePoints?: number;
  blockedUsers: Types.ObjectId[];
  clubhouseStatus?: ClubhouseStatus;
  lastClubhouseActivity?: Date;
  clubhouseActiveSince?: Date;
  clubhouseBadge?: ClubhouseBadge | null;
  badgeEarnedAt?: Date | null;
  dailyClubhouseStats?: IDailyClubhouseStats;
  lastDecayAppliedAt?: Date | null;
  lastInactivityNotificationAt?: Date | null;
  badgeProximityNotified?: IBadgeProximityNotified;
  line?: ILineItem[];

  // Boost fields
  boostedUntil?: Date | null;
  boostsUsedThisMonth?: number;
  lastBoostResetDate?: Date | null;


  // Clubhouse Boost fields
  clubhouseBoostsUsedThisMonth?: number;
  lastClubhouseBoostResetDate?: Date | null;

  // Location tracking fields
  locationChangesThisMonth?: number;
  lastLocationChangeResetDate?: Date | null;

  // Super Like tracking fields
  superLikesThisMonth?: number;
  lastSuperLikeResetDate?: Date | null;

  isIncognito?: boolean;
  moreAboutGender?: string;
  politics?: Politics;
zodiac?: Zodiac;
educationPlan?: EducationPlan;
communicationStyle?: CommunicationStyle;
loveLanguage?: LoveLanguage;
cannabis?: CannabisUsage;
workout?: Workout;
petType?: PetType;
  trustScore: number;
  reportCount: number;
}



