import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { SubscriptionService } from "./subscription.service";
import AppError from "../../errorHelpers/AppError";
import Subscription from "./subscription.model";
import { Plan, SubscriptionStatus } from "./subscription.interface";
import mongoose from "mongoose";

const createSubscription = catchAsync(async (req: Request, res: Response) => {

    // const { userId } = req.user as JwtPayload;
    const userId = "69a65518b1884ecd3f638ce3"; // test ObjectId
    const result = await SubscriptionService.createSubscription({
        ...req.body,
        userId,
    });

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.CREATED,
        message: "Subscription created successfully",
        data: result,
    });
});

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
   
    const { id } = req.user as JwtPayload;
    const result = await SubscriptionService.getMySubscription(id);
console.log("My Subscription:", result);
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscription retrieved successfully",
        data: result,
    });
});

const updateSubscription = catchAsync(async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const data  = req.body;

    const result = await SubscriptionService.updateSubscriptionStatus(
        transactionId as string,
        data
    );
console.log(data)
    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscription updated successfully",
        data: result,
    });
});

const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
    const result = await SubscriptionService.getAllSubscriptions(req.query);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscriptions retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user as JwtPayload;

    const result = await SubscriptionService.cancelSubscription(id);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscription cancelled successfully",
        data: result,
    });
});

const createTrialSubscription = catchAsync(async (req: Request, res: Response) => {
      const userId = new mongoose.Types.ObjectId("69a65518b1884ecd3f638ce3");
    const platform = "android"; // or "ios"

    if (!userId || !platform) {
        throw new AppError(StatusCodes.BAD_REQUEST, "userId and platform are required");
    }

    // Optional: prevent duplicate trial
    const existingTrial = await Subscription.findOne({
        userId,
        plan_type: Plan.MULLI_TRIAL,
    });

    if (existingTrial) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Trial subscription already exists");
    }

    const startDate = new Date();
    const endDate = new Date("2099-12-31"); // effectively unlimited

    const result = await SubscriptionService.createSubscription({
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan_type: Plan.MULLI_TRIAL,
        platform, // "ios" or "android"

        productId: "trial_plan",
        transactionId: `trial_${userId}_${Date.now()}`, // unique
        originalTransactionId: `trial_${userId}`,

        start_date: startDate,
        end_date: endDate,

        auto_renew: false,
        total_spent: 0,
    });

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.CREATED,
        message: "Unlimited trial subscription created successfully",
        data: result,
    });
});
// const subscriptionWebhook = catchAsync(async (req: Request, res: Response) => {
//     // Webhook payload usually comes in req.body.
//     const result = await SubscriptionService.subscriptionWebhook(req.body);

//     sendResponse(res, {
//         success: true,
//         statusCode: StatusCodes.OK,
//         message: "Webhook processed successfully",
//         data: result,
//     });
// });

export const SubscriptionController = {
    createSubscription,
    getMySubscription,
    updateSubscription,
    getAllSubscriptions,
    cancelSubscription,
    createTrialSubscription,
    // subscriptionWebhook,
};