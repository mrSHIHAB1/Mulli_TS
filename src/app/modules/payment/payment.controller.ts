import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { PaymentService } from "./payment.service";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import PaymentTransaction from "./payment.model";

const verifyPurchase = catchAsync(async (req: Request, res: Response) => {
   const { id} = req.user as JwtPayload;

  const result = await PaymentService.verifyPurchase({
    ...req.body,
    userId: id,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Subscription verified successfully",
    data: result,
  });
});

const appleWebhook = async (req: Request, res: Response) => {
  try {
    const result = await PaymentService.handleAppleWebhook(req);

    res.status(200).json({
      success: true,
      message: "Webhook processed",
      data: result,
    });
  } catch (error: any) {
    console.error("Webhook Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

/**
 * Get payment transaction history for the authenticated user
 */
const getTransactionHistory = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;
    const { limit = 50, skip = 0, type, status } = req.query;

    const filter: any = { userId: id };

    if (type) {
      filter.transactionType = type;
    }

    if (status) {
      filter.status = status;
    }

    const transactions = await PaymentTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    const total = await PaymentTransaction.countDocuments(filter);

    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Payment transaction history retrieved",
      data: {
        transactions,
        pagination: {
          total,
          limit: Number(limit),
          skip: Number(skip),
        },
      },
    });
  }
);

/**
 * Get payment summary for the authenticated user
 */
const getPaymentSummary = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as JwtPayload;

  const totalSpent = await PaymentTransaction.aggregate([
    {
      $match: {
        userId: id,
        status: "COMPLETED",
        transactionType: { $in: ["PURCHASE", "RENEWAL"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const transactionsByType = await PaymentTransaction.aggregate([
    {
      $match: { userId: id },
    },
    {
      $group: {
        _id: "$transactionType",
        count: { $sum: 1 },
      },
    },
  ]);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payment summary retrieved",
    data: {
      totalSpent: totalSpent[0]?.total || 0,
      transactionCount: totalSpent[0]?.count || 0,
      transactionsByType,
    },
  });
});

export const PaymentController = {
  verifyPurchase,
  appleWebhook,
  getTransactionHistory,
  getPaymentSummary,
};