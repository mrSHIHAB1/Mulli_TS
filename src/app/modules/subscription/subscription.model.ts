import { model, Schema } from "mongoose";
import { ISubscription, Plan, SubscriptionStatus } from "./subscription.interface";

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    plan_type: { type: String, enum: Object.values(Plan), required: true },
    platform: { type: String, enum: ["ios", "android"], required: true },

    productId: { type: String, required: true },
    transactionId: { type: String, required: true, unique: true },
    originalTransactionId: { type: String, required: true },

    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },

    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.ACTIVE },

    auto_renew: { type: Boolean, default: true },

    total_spent: { type: Number, default: 0 },
    renewal_date: { type: Date },
  },
  { timestamps: true },
);

const Subscription = model<ISubscription>("Subscription", subscriptionSchema);
export default Subscription;