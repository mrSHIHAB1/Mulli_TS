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

// This should reflect the fields we actually use in services, auth, and passport.
// It's intentionally permissive (many fields optional) to avoid blocking on strict typing.
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
    fcmTokens?: string[] ,
  // Misc fields used by the new dating/golf profile
  birthdate?: Date;
  trackactivity?: "Once" | "While_Using" | "No";
  gender?: "Men" | "Women" | "Nonbinary" | "ALL";
  genderPreference?: "Men" | "Women" | "Nonbinary" | "ALL";
  hopingToFind?: "Long_Term" | "Casual" | "Ethical";
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
  images?: string[];
  prompt?: string[];
  languages?: string[];
  bio?: string;
  playstyle?: "Golf_Buddy" | "Golf_Date";
  location?: {
    type?: string;
    coordinates?: [number, number];
    placeName?: string;
  };
  useLocation?: boolean;
  reciveNotifications?: boolean;
  profileImage?: string;
  enableFaceId?: boolean;
  blockedUsers: Types.ObjectId[];
  coins?: number;
}

