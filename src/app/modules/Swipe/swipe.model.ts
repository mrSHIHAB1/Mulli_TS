import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISwipeDocument extends Document {
  fromUser: mongoose.Types.ObjectId;
  toUser: mongoose.Types.ObjectId;
  action: "like" | "pass" | "gift";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SwipeSchema: Schema<ISwipeDocument> = new Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["like", "pass", "gift"],
      required: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

SwipeSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });
SwipeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Swipe: Model<ISwipeDocument> = mongoose.model<ISwipeDocument>(
  "Swipe",
  SwipeSchema
);

export default Swipe;

