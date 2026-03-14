import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { SubscriptionService } from "./subscription.service";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
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
    const { userId } = req.user as JwtPayload;
    const result = await SubscriptionService.getMySubscription(userId);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscription retrieved successfully",
        data: result,
    });
});

const updateSubscription = catchAsync(async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    const { status } = req.body;

    const result = await SubscriptionService.updateSubscriptionStatus(
        transactionId as string,
        status
    );

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
    const { userId } = req.user as JwtPayload;

    const result = await SubscriptionService.cancelSubscription(userId);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Subscription cancelled successfully",
        data: result,
    });
});

const subscriptionWebhook = catchAsync(async (req: Request, res: Response) => {
    // Webhook payload usually comes in req.body.
    const result = await SubscriptionService.subscriptionWebhook(req.body);

    sendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Webhook processed successfully",
        data: result,
    });
});

export const SubscriptionController = {
    createSubscription,
    getMySubscription,
    updateSubscription,
    getAllSubscriptions,
    cancelSubscription,
    subscriptionWebhook,
};