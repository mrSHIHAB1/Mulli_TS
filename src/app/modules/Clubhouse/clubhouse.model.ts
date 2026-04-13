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
  ReportType,
  ICategorySetting,
 
  IClubhouseFollow,
  ReactionType
} from "./clubhouse.interface ";
import { report } from "process";

const reactionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: Object.values(ReactionType), required: true },
});

const reactionCountSchema = new Schema({
  like: { type: Number, default: 0 },
  fire: { type: Number, default: 0 },
  haha: { type: Number, default: 0 },
}, { _id: false });

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
    reactions: [reactionSchema],
    reactionCount: {
      type: reactionCountSchema,
      default: () => ({ like: 0, fire: 0, haha: 0 })
    },
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
  milestoneAwarded: { type: Boolean, default: false },
  boostedAt: { type: Date, default: null },
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
    reactions: [reactionSchema],
    reactionCount: {
      type: reactionCountSchema,
      default: () => ({ like: 0, fire: 0, haha: 0 })
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



const categorySettingSchema = new Schema<ICategorySetting>(
  {
    category: {
      type: String,
      enum: Object.values(PostCategory),
      required: true,
      unique: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export const CategorySetting: Model<ICategorySetting> =mongoose.model<ICategorySetting>("CategorySetting", categorySettingSchema);
  
export default Post;

const clubhouseFollowSchema = new Schema<IClubhouseFollow>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  postType: { type: String, enum: Object.values(PostCategory), required: true },
  followedAt: { type: Date, default: Date.now }
});


export const ClubhouseFollow = mongoose.model<IClubhouseFollow>("ClubhouseFollow", clubhouseFollowSchema);