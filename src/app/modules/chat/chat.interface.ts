import { Types } from "mongoose";

export enum MessageStatus {
  SENT = "SENT",
  SEEN = "SEEN",
}
export type MediaType = "image" | "video" | "audio";

export interface IMedia {
  url: string;
  type: MediaType;
}
export interface IMessage {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;
  receiver?: Types.ObjectId;
  message: {
    text: string;
    media?: IMedia[];
  };
  status: MessageStatus;
  replyTo?: Types.ObjectId;
}
