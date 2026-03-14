import { Schema, model } from "mongoose";
import { Types } from "mongoose";

export enum Plan {
  MULLI_PLUS = "MULLI_PLUS",
  MULLI_X = "MULLI_X",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  PAST_DUE = "PAST_DUE",
}

export interface ISubscription {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;

  plan_type: Plan;

  platform: "ios" | "android"; // Apple or Google

  productId: string; // Apple/Google product id
  transactionId: string; // unique purchase id
  originalTransactionId: string; // subscription chain id

  start_date: Date;
  end_date: Date;

  status: SubscriptionStatus;

  auto_renew: boolean;

  total_spent: number;

  renewal_date?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
