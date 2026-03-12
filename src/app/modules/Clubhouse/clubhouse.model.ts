import mongoose, { Schema, Model } from "mongoose";
import {
  IClubhouseDocument,
  PostCategory,
  PostType,
  PlayStyle,
  Mobility,
  Conversation,
  PostRoundInterest,
  Visibility,
  MediaType,
  ICommentDocument,
  VibeType,
  ReportType
} from "./clubhouse.interface ";
import { report } from "process";

const clubhouseSchema = new Schema<IClubhouseDocument>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(PostCategory),
      required: true,
    },
    postType: {
      type: String,
      enum: Object.values(PostType),

    },
    playDetails: {
      golfCourse: String,
      facilities: [String],
      location: String,
      flexibleLocation: { type: Boolean, default: false },
      date: Date,
      time: String,
      flexibledate: { type: Boolean, default: false },
      playersNeeded: Number,
      handicapRange: {
        lowest: { type: Number },
        highest: { type: Number }
      },
      playStyle: {
        type: String,
        enum: Object.values(PlayStyle),
      },
      tees: { type: String },
      yardage: { type: Number },


      mobility: {
        type: String,
        enum: Object.values(Mobility),
      },
      conversation: {
        type: String,
        enum: Object.values(Conversation),
      },
      vibe: {
        type: String,
        enum: Object.values(VibeType),
      },
      postRoundInterest: {
        type: String,
        enum: Object.values(PostRoundInterest),
      },
      notes: String,
      gimimies: { type: Boolean, default: false },
      Mulligans: { type: Boolean, default: false },
    },
    visibility: {
      type: String,
      enum: Object.values(Visibility),
      default: Visibility.PUBLIC,
    },
    whatsOnYourMind: { type: String, trim: true },
    media: [String],
    backgroundColor: String,
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    gifts: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        giftType: String,
        sentAt: { type: Date, default: Date.now },
      },
    ],
   reports: [
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(ReportType), required: true },
    reportedAt: { type: Date, default: Date.now },
  }
],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Optional: Add an index for faster searching by category/author
clubhouseSchema.index({ author: 1, category: 1 });

export const Post: Model<IClubhouseDocument> = mongoose.model<IClubhouseDocument>("Post", clubhouseSchema);

const commentSchema = new Schema<ICommentDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

export const Comment: Model<ICommentDocument> = mongoose.model<ICommentDocument>(
  "Comment",
  commentSchema
);

export default Post;