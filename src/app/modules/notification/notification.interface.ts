/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";

export enum NotificationType {
  CHAT_MESSAGE = "CHAT_MESSAGE",
  FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED",
  SYSTEM = "SYSTEM",
  NEW_LIKE = "NEW_LIKE",
  NEW_MATCH = "NEW_MATCH",
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
