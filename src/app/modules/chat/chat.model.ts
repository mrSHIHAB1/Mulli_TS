import { Schema, model, Types } from "mongoose";
import { IMessage, MessageStatus } from "./chat.interface";

const subSchema = new Schema(
  {
    text: { type: String },
    type: { type: String, enum: ["image", "video", "audio"], required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    _id: false,
  },
);

const messageSchema = new Schema<IMessage>(
  {
    receiver: { type: Types.ObjectId, ref: "User", required: true },
    sender: { type: Types.ObjectId, ref: "User", required: true },
    message: {
      text: { type: String, default: "" },
      media: [
        {
          url: { type: String, required: true },
          type: { type: String, enum: ["image", "video", "audio"], required: true },
        }
      ],
    },
    status: { type: String, enum: [...Object.keys(MessageStatus)] },
    replyTo: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Message = model<IMessage>("Message", messageSchema);
