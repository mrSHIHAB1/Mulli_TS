import { model, Schema } from "mongoose";
import {
  IPaymentTransaction,
  PaymentTransactionType,
  PaymentTransactionStatus,
  PaymentPlatform,
} from "./payment.interface";

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      sparse: true,
    },

    // Transaction Identifiers
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    originalTransactionId: {
      type: String,
      sparse: true,
      index: true,
    },
    orderRef: {
      type: String,
      sparse: true,
    },

    // Transaction Details
    transactionType: {
      type: String,
      enum: Object.values(PaymentTransactionType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentTransactionStatus),
      default: PaymentTransactionStatus.PENDING,
      index: true,
    },

    // Payment Info
    platform: {
      type: String,
      enum: Object.values(PaymentPlatform),
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },

    // Plan Info
    planType: {
      type: String,
      sparse: true,
    },
    billingCycle: {
      type: String,
      enum: ["1m", "3m", "1y"],
      sparse: true,
    },

    // Dates
    purchaseDate: {
      type: Date,
      required: true,
      index: true,
    },
    expiryDate: {
      type: Date,
      sparse: true,
    },
    refundDate: {
      type: Date,
      sparse: true,
    },

    // Webhook/Event Info
    webhookEventType: {
      type: String,
      sparse: true,
    },
    webhookPayload: {
      type: Schema.Types.Mixed,
      sparse: true,
    },

    // Error Handling
    errorMessage: {
      type: String,
      sparse: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },

    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
      sparse: true,
    },
  },
  { timestamps: true }
);

// Compound indices for common queries
paymentTransactionSchema.index({ userId: 1, createdAt: -1 });
paymentTransactionSchema.index({ userId: 1, transactionType: 1 });
paymentTransactionSchema.index({ userId: 1, status: 1 });
paymentTransactionSchema.index({ userId: 1, platform: 1 });
paymentTransactionSchema.index({ transactionId: 1, platform: 1 });

const PaymentTransaction = model<IPaymentTransaction>(
  "PaymentTransaction",
  paymentTransactionSchema
);

export default PaymentTransaction;
