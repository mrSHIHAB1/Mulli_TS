import mongoose, { Schema, Document, Model } from "mongoose";
import { AuthProviderType, IsActive, IUser, Role } from "./user.interface";




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
      enum: ["Long_Term", "Casual", "Ethical"],
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
    profileImage: { type: String },
    enableFaceId: { type: Boolean, default: false },
    bio: { type: String },
    languages: [{ type: String }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

UserSchema.index({ location: "2dsphere" });

export const User: Model<IUser> = mongoose.model<IUser>(
  "User",
  UserSchema
);

export default User;