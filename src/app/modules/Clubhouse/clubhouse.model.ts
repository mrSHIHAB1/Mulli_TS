import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPostDocument extends Document {
  author: mongoose.Types.ObjectId;
  category: string;
  postType: string;
  playDetails?: {
    golfCourse?: string;
    facilities?: string[];
    flexibleLocation?: boolean;
    date?: Date;
    time?: string;
    playersNeeded?: number;
    playStyle?: string;
    mobility?: string;
    conversation?: string;
    vibe?: {
      music?: boolean;
      beerCart?: boolean;
      smoker?: boolean;
      mulligans?: boolean;
      gimmies?: boolean;
    };
    postRoundInterest?: string;
    notes?: string;
  };
  visibility: string;
  whatsOnYourMind?: string;
  media: {
    type: string;
    url: string;
  }[];
  likes: mongoose.Types.ObjectId[];
  comments: {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];
  commentsCount: number;
  gifts: {
    user: mongoose.Types.ObjectId;
    giftType: string;
    sentAt: Date;
  }[];
  backgroundColor?: string;
}

const postSchema: Schema<IPostDocument> = new Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // STEP 1: CATEGORY
    category: {
      type: String,
      enum: [
        "find_golf_buddy",
        "rate_my_swing",
        "local_chatter",
        "experts_only",
        "ladies_only",
      ],
      required: true,
    },

    // STEP 2: POST TYPE
    postType: {
      type: String,
      enum: ["play", "practice", "match"],
      required: true,
    },

    // PLAY DETAILS
    playDetails: {
      golfCourse: String,
      facilities: [String],
      flexibleLocation: {
        type: Boolean,
        default: false,
      },
      date: Date,
      time: String,
      playersNeeded: Number,
      playStyle: {
        type: String,
        enum: ["quick_3", "quick_4", "social_slow"],
      },
      mobility: {
        type: String,
        enum: ["walking", "cart"],
      },
      conversation: {
        type: String,
        enum: ["quiet_focused", "friendly_respectful", "chill_chatty"],
      },
      vibe: {
        music: Boolean,
        beerCart: Boolean,
        smoker: Boolean,
        mulligans: Boolean,
        gimmies: Boolean,
      },
      postRoundInterest: {
        type: String,
        enum: ["grab_drink", "practice_more", "head_home"],
      },
      notes: String,
    },

    // STEP 3: CREATE POST
    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },

    whatsOnYourMind: String,

    media: [
      {
        type: {
          type: String,
          enum: ["image", "video", "gif"],
        },
        url: String,
      },
    ],

    backgroundColor: String,

    // HOME PAGE INTERACTIONS
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    commentsCount: {
      type: Number,
      default: 0,
    },

    gifts: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        giftType: String,
        sentAt: Date,
      },
    ],
  },
  { timestamps: true }
);

export const Post: Model<IPostDocument> = mongoose.model<IPostDocument>(
  "Post",
  postSchema
);

export default Post;

