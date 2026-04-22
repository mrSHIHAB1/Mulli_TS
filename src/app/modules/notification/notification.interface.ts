/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";

export enum NotificationType {
  CHAT_MESSAGE = "CHAT_MESSAGE",
  FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED",
  SYSTEM = "SYSTEM",
  NEW_LIKE = "NEW_LIKE",
  NEW_MATCH = "NEW_MATCH",
  POST_LIKED = "POST_LIKED",
  COMMENT_LIKED = "COMMENT_LIKED",
  POST_COMMENTED = "POST_COMMENTED",
  BADGE_EARNED = "BADGE_EARNED",
  BADGE_DOWNGRADE_WARNING = "BADGE_DOWNGRADE_WARNING",
  BADGE_PROXIMITY = "BADGE_PROXIMITY",
  CLUBHOUSE_INACTIVITY = "CLUBHOUSE_INACTIVITY",
}

export interface INotificationData {
  chatId?: string;
  senderId?: string;
  receiverId?: string;
  deepLink?: string;
  matchId?: string;
  [key: string]: any;
}

export interface INotification {
  _id?: Types.ObjectId;
  user: Types.ObjectId; // receiver user id
  type: NotificationType;
  title: string;
  body: string;
  data?: INotificationData;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
