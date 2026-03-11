/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import { chatService } from "./chat.service";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { fileUploader } from "../../helpers/fileUpload";

import { StatusCodes } from "http-status-codes";
import { sendResponse } from "../../utils/sendResponse";

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { receiverId } = req.params as { receiverId: string };
  const user = req.user as JwtPayload;
  const files = req.files as Express.Multer.File[] | undefined;

  // Upload all files at once, order preserved
  const media = files?.length
    ? await fileUploader.uploadManyToCloudinary(files)
    : [];

  const messageData = {
    ...req.body,
    message: {
      text: req.body.message?.text || req.body.text || "",
      media,
    },
  };

  const result = await chatService.sendMessageService(user, receiverId, messageData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Message sent successfully!",
    data: result,
  });
});
const getConversations = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;

  const chats = await chatService.getConversationsService(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Conversations fetched successfully",
    data: chats,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { otherUserId } = req.params;

  const messages = await chatService.getMessagesService(
    user,
    otherUserId as string,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Messages fetched successfully",
    data: messages,
  });
});

const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const user = req.user as JwtPayload;

  const result = await chatService.deleteMessageService(user, messageId as string);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Message deleted successfully!",
    data: result,
  });
});

// Add to exports

export const ChatController = {
  sendMessage,
  getConversations,
  getMessages,
  deleteMessage

};
