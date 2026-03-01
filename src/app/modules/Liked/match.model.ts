import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMatchDocument extends Document {
  users: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema: Schema<IMatchDocument> = new Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

MatchSchema.index({ users: 1 }, { unique: true });

export const Match: Model<IMatchDocument> = mongoose.model<IMatchDocument>(
  "Match",
  MatchSchema
);

export default Match;

