import { Types } from "mongoose";

// ============ Payment Transaction Types ============

export enum PaymentTransactionType {
  PURCHASE = "PURCHASE",
  RENEWAL = "RENEWAL",
  REFUND = "REFUND",
  CANCELLATION = "CANCELLATION",
  REACTIVATION = "REACTIVATION",
  PLAN_UPGRADE = "PLAN_UPGRADE",
  PLAN_DOWNGRADE = "PLAN_DOWNGRADE",
  FAILED = "FAILED",
}

export enum PaymentTransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum PaymentPlatform {
  APPLE_IAP = "APPLE_IAP",
  GOOGLE_PLAY = "GOOGLE_PLAY",
  WEB = "WEB",
  STRIPE = "STRIPE",
}

// ============ Payment Transaction Interface ============

export interface IPaymentTransaction {
  _id?: Types.ObjectId;
  
  // User & Subscription Info
  userId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  
  // Transaction Identifiers
  transactionId: string; // Unique transaction identifier from payment provider
  originalTransactionId?: string; // Original transaction ID (for renewals/refunds)
  orderRef?: string; // Order reference if applicable
  
  // Transaction Details
  transactionType: PaymentTransactionType;
  status: PaymentTransactionStatus;
  
  // Payment Info
  platform: PaymentPlatform;
  productId: string;
  amount: number; // Amount in cents (e.g., $9.99 = 999)
  currency: string; // ISO currency code (e.g., "USD")
  
  // Plan Info
  planType?: string;
  billingCycle?: "1m" | "3m" | "1y"; // Billing period
  
  // Dates
  purchaseDate: Date;
  expiryDate?: Date;
  refundDate?: Date;
  
  // Webhook/Event Info
  webhookEventType?: string; // Apple: EXPIRED, DID_RENEW, REFUND, etc.
  webhookPayload?: Record<string, any>; // Full webhook payload for audit trail
  
  // Error Handling
  errorMessage?: string;
  retryCount?: number;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt?: Date;
  updatedAt?: Date;
}
