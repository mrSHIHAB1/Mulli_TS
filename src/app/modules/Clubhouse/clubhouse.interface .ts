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
// --- SUB-INTERFACES ---
export interface IVibe {
  music?: boolean;
  beerCart?: boolean;
  smoker?: boolean;
  mulligans?: boolean;
  gimmies?: boolean;
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
  vibe?: IVibe;
  postRoundInterest?: PostRoundInterest;
  notes?: string;
}

export interface IComment {
  user: Types.ObjectId;
  post: Types.ObjectId;
  text: string;
  parentId?: Types.ObjectId;
  likes: Types.ObjectId[];
  likesCount: number;
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
// --- MAIN INTERFACE ---
export interface IClubhouse {
  author: Types.ObjectId;
  category: PostCategory;
  postType: PostType;
  playDetails?: IPlayDetails;
  visibility: Visibility;
  whatsOnYourMind?: string;
  media: string[];
  likes: Types.ObjectId[];
  likesCount: number;
  commentsCount: number;
  gifts: {
    user: Types.ObjectId;
    giftType: string;
    sentAt: Date;
  }[];
  backgroundColor?: string;
  reports: IReport[];
}

export interface IClubhouseDocument extends IClubhouse, Document {
  createdAt: Date;
  updatedAt: Date;
}