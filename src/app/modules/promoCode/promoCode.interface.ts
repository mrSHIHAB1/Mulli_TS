import { Types } from "mongoose";

export interface IPromoCode {
  _id?: Types.ObjectId;
  code: string;
  tier: string;
  partner_name?: string;
  max_uses: number;
  uses_count: number;
  expires_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
