import { Types, Document } from "mongoose";

// --- ENUMS ---
export enum PostCategory {
  FIND_GOLF_BUDDY = "FIND_GOLF_BUDDY",
  RATE_MY_SWING = "RATE_MY_SWING",
  LOCAL_CHATTER = "LOCAL_CHATTER",
  EXPERTS_ONLY = "EXPERTS_ONLY",
  LADIES_ONLY = "LADIES_ONLY",
}

export enum PostType {
  PLAY = "PLAY",
  PRACTICE = "PRACTICE",
  MATCH = "MATCH",
}

export enum PlayStyle {
  QUICK_3 = "QUICK_3",
  QUICK_4 = "QUICK_4",
  SOCIAL_SLOW = "SOCIAL_SLOW",
}

export enum Mobility {
  WALKING = "WALKING",
  CART = "CART",
}

export enum Conversation {
  QUIET_FOCUSED = "QUIET_FOCUSED",
  FRIENDLY_RESPECTFUL = "FRIENDLY_RESPECTFUL",
  CHILL_CHATTY = "CHILL_CHATTY",
}

export enum PostRoundInterest {
  GRAB_DRINK = "GRAB_DRINK",
  PRACTICE_MORE = "PRACTICE_MORE",
  HEAD_HOME = "HEAD_HOME",
}

export enum Visibility {
  PUBLIC = "PUBLIC",
  FRIENDS = "FRIENDS",
  PRIVATE = "PRIVATE",
}

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  GIF = "gif",
}
export enum VibeType {
  MUSIC = "MUSIC",
  BEER_CART = "BEER_CART",
  SMOKER = "SMOKER",
  MULLIGANS = "MULLIGANS",
  GIMMIES = "GIMMIES",
}
export enum ReportType {
  FAKE_PROFILE = "FAKE_PROFILE",
  INAPPROPRIATE = "INAPPROPRIATE",
  SCAM = "SCAM",
  HATE = "HATE",
  UNDERAGE= "UNDERAGE",
  NOT_INTERESTED = "NOT_INTERESTED",
}

export enum ReactionType {
  LIKE = "like",
  FIRE = "fire",
  HAHA = "haha",
}
// --- SUB-INTERFACES ---
export interface IReaction {
  user: Types.ObjectId;
  type: ReactionType;
}

export interface IReactionCount {
  like: number;
  fire: number;
  haha: number;
}


export interface IPlayDetails {
  golfCourse?: string;
  facilities?: string[];
  location?: string;
  flexibleLocation?: boolean;
  date?: Date;
  time?: string;
  playersNeeded?: number;
  playStyle?: PlayStyle;
  mobility?: Mobility;
  conversation?: Conversation;
  vibe?: string[];
  postRoundInterest?: PostRoundInterest;
  notes?: string;
}

export interface IComment {
  user: Types.ObjectId;
  post: Types.ObjectId;
  text: string;
  parentId?: Types.ObjectId;
  reactions: IReaction[];
  reactionCount: IReactionCount;
}

export interface ICommentDocument extends IComment, Document {
  createdAt: Date;
  updatedAt: Date;
}
export interface IReport {
 
  user: Types.ObjectId;
  type: ReportType;
  reportedAt: Date;
}
export interface ICategorySetting {
  category: PostCategory;
  isActive: boolean;
}
// --- MAIN INTERFACE ---
export interface IClubhouse {
  author: Types.ObjectId;
  category: PostCategory;
  postType: PostType;
  playDetails?: IPlayDetails;
  visibility: Visibility;
  whatsOnYourMind?: string;
  media: string[];
  reactions: IReaction[];
  reactionCount: IReactionCount;
  commentsCount: number;
  gifts: {
    user: Types.ObjectId;
    giftType: string;
    sentAt: Date;
  }[];
  backgroundColor?: string;
  reports: IReport[];
  milestoneAwarded?: boolean;
  boostedAt?: Date;
}


export interface IClubhouseDocument extends IClubhouse, Document {
  createdAt: Date;
  updatedAt: Date;
}


export interface IClubhouseFollow {
  user: Types.ObjectId;
  postType: PostCategory;
  followedAt: Date;
}