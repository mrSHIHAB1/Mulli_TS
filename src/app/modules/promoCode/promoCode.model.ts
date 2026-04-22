import { model, Schema } from "mongoose";
import { IPromoCode } from "./promoCode.interface";

const promoCodeSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true },
    tier: { type: String, default: 'Birdie' },
    partner_name: String,
    max_uses: { type: Number, default: 100 },
    uses_count: { type: Number, default: 0 },
    expires_at: Date,
  },
  { timestamps: true }
);

const PromoCode = model<IPromoCode>("PromoCode", promoCodeSchema);
export default PromoCode;
