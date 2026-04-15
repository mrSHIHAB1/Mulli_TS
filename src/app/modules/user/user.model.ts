import mongoose, { Schema, Document, Model } from "mongoose";
import { AuthProviderType, ClubhouseBadge, ClubhouseStatus, IsActive, IUser, Role } from "./user.interface";




const UserSchema: Schema<IUser> = new Schema(
  {
    // Account
    phone: { type: String },
    email: { type: String },
    shareEmail: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },

    // Legacy auth flags used by passport/checkAuth
    isActive: {
      type: String,
      enum: Object.values(IsActive),
      default: IsActive.ACTIVE,
    },
    isDeleted: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isblocked: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },

    // Password & auth providers (for local/google/apple login)
    password: { type: String, select: false },
    auth_providers: [
      {
        provider: {
          type: String,
          enum: Object.values(AuthProviderType),
        },
        providerID: { type: String },
      },
    ],

    // Profile
    name: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    birthdate: { type: Date },
    trackactivity: {
      type: String,
      enum: ["Once", "While_Using", "No"],
      default: "No",
    },
    gender: {
      type: String,
      enum: ["Men", "Women", "Nonbinary", "ALL"],
    },
    genderPreference: {
      type: String,
      enum: ["Men", "Women", "Nonbinary", "ALL"],
    },
    hopingToFind: {
      type: String,
      enum: ["Long_Term", "Short_Term", "Casual", "Ethical"],
    },
    ethnicity: { type: String },
    country: { type: String },
    religion: { type: String },
    skillLevel: {
      type: String,
      enum: ["Beginner", "Novice", "Intermediate", "Advanced", "Expert"],
    },
    handicaprange: {
      minRange: { type: Number, default: 0 },
      maxRange: { type: Number, default: 100 },
    },

    height: { type: Number, default: 0 },
    fcmTokens: [{ type: String }],
    hasKids: { type: Boolean, default: false },
    wantsKids: { type: String, default: false },
    drinking: { type: String },
    smoking: { type: String },
    images: [String],
    prompt: [{ type: String }],
    playstyle: { type: String, enum: ["Golf_Buddy", "Golf_Date"] },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      placeName: { type: String },
    },
    useLocation: { type: Boolean, default: false },
    reciveNotifications: { type: Boolean, default: true },
    appleId: { type: String, index: true },
provider: { type: String, enum: ["apple", "google", "phone", "email"] },
    profileImage: { type: String },
    enableFaceId: { type: Boolean, default: false },
    badgePoints: { type: Number, default: 0 },
    clubhouseStatus: {
      type: String,
      enum: Object.values(ClubhouseStatus),
      default: ClubhouseStatus.IN_CLUBHOUSE,
    },
    lastClubhouseActivity: { type: Date, default: null },
    clubhouseActiveSince: { type: Date, default: null },
    clubhouseBadge: {
      type: String,
      enum: [...Object.values(ClubhouseBadge), null],
      default: null,
    },
    badgeEarnedAt: { type: Date, default: null },
    lastDecayAppliedAt: { type: Date, default: null },
    dailyClubhouseStats: {
      date: { type: Date },
      givenPoints: { type: Number, default: 0 },
      postsCreated: { type: Number, default: 0 },
      bonusPostsAwarded: { type: Number, default: 0 },
      likesGiven: { type: Number, default: 0 },
      strongReactionsGiven: { type: Number, default: 0 },
      commentsGiven: { type: Number, default: 0 },
    },
    lastInactivityNotificationAt: { type: Date, default: null },
    badgeProximityNotified: {
      risingstar: { type: Boolean, default: false },
      locallegend: { type: Boolean, default: false },
      clubhousechampion: { type: Boolean, default: false },
    },
    bio: { type: String },
    languages: [{ type: String }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Boost fields
    boostedUntil: { type: Date, default: null },
    boostsUsedThisMonth: { type: Number, default: 0 },
    lastBoostResetDate: { type: Date, default: null },

    // Clubhouse Post Boost fields
    clubhouseBoostsUsedThisMonth: { type: Number, default: 0 },
    lastClubhouseBoostResetDate: { type: Date, default: null },

    // Location changes tracking
    locationChangesThisMonth: { type: Number, default: 0 },
    lastLocationChangeResetDate: { type: Date, default: null },

    // Super Like tracking fields
    superLikesThisMonth: { type: Number, default: 0 },
    lastSuperLikeResetDate: { type: Date, default: null },
  },

  { timestamps: true }
);

UserSchema.index({ location: "2dsphere" });

export const User: Model<IUser> = mongoose.model<IUser>(
  "User",
  UserSchema
);

export default User;