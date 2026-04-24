/**
 * Discovery Ranking Data Model
 * 
 * Stores all scoring, bucket, and ranking data separately from the User model.
 * This keeps the User model clean and separates concerns.
 * 
 * Each user will have one DiscoveryScore document per mode (buddy and date)
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDiscoveryScore extends Document {
  userId: mongoose.Types.ObjectId;
  mode: "buddy" | "date";

  // Compatibility & Desire Scores
  compatibilityScore: number;
  desireScore: number;
  baseScore: number;

  // Trust & Boost
  trustScore: "RED" | "ORANGE" | "GREEN";
  isBoosted: boolean;
  boostType?: "MANUAL" | "SUBSCRIPTION" | null;
  boostedUntil?: Date | null;

  // Bucket Categorization
  bucket: "A" | "B" | "C";

  // New User Status
  isNewUser: boolean;
  newUserWindowExpiresAt?: Date | null;

  // Scoring Metadata
  matchRate: number;
  likeRate: number;
  totalLikesReceived: number;
  totalSwipesReceived: number;

  // Final calculated score (after modifiers)
  finalScore: number;

  // Tracking
  bucketCalculatedAt: Date;
  scoreCalculatedAt: Date;
  lastUpdatedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const DiscoveryScoreSchema: Schema<IDiscoveryScore> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["buddy", "date"],
      required: true,
      index: true,
    },

    // Compatibility & Desire Scores (0-100)
    compatibilityScore: { type: Number, default: 0, min: 0, max: 100 },
    desireScore: { type: Number, default: 0, min: 0, max: 100 },
    baseScore: { type: Number, default: 0, min: 0, max: 100 },

    // Trust & Boost
    trustScore: {
      type: String,
      enum: ["RED", "ORANGE", "GREEN"],
      default: "GREEN",
      index: true,
    },
    isBoosted: { type: Boolean, default: false, index: true },
    boostType: {
      type: String,
      enum: ["MANUAL", "SUBSCRIPTION", null],
      default: null,
    },
    boostedUntil: { type: Date, default: null, index: true },

    // Bucket Categorization
    bucket: {
      type: String,
      enum: ["A", "B", "C"],
      default: "C",
      index: true,
    },

    // New User Tracking
    isNewUser: { type: Boolean, default: false, index: true },
    newUserWindowExpiresAt: { type: Date, default: null },

    // Scoring Metadata
    matchRate: { type: Number, default: 0, min: 0, max: 100 },
    likeRate: { type: Number, default: 0, min: 0, max: 100 },
    totalLikesReceived: { type: Number, default: 0 },
    totalSwipesReceived: { type: Number, default: 0 },

    // Final Score (after applying modifiers)
    finalScore: { type: Number, default: 0, min: 0, max: 120, index: true },

    // Tracking Timestamps
    bucketCalculatedAt: { type: Date, default: new Date() },
    scoreCalculatedAt: { type: Date, default: new Date() },
    lastUpdatedAt: { type: Date, default: new Date() },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
DiscoveryScoreSchema.index({ userId: 1, mode: 1 }, { unique: true });
DiscoveryScoreSchema.index({ mode: 1, bucket: 1, finalScore: -1 });
DiscoveryScoreSchema.index({ mode: 1, isNewUser: 1 });
DiscoveryScoreSchema.index({ mode: 1, isBoosted: 1, finalScore: -1 });

export const DiscoveryScore: Model<IDiscoveryScore> = mongoose.model<IDiscoveryScore>(
  "DiscoveryScore",
  DiscoveryScoreSchema
);

export default DiscoveryScore;
