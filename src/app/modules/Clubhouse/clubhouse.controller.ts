/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { fileUploader } from "../../helpers/fileUpload";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { postServices } from "./clubhouse.service";

/* ================= CREATE POST ================= */
const createPost = catchAsync(async (req: Request, res: Response) => {
  // In production, req.user should be set by auth middleware
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to create a post");
  }

  // 1️⃣ Parse JSON from 'data' field
  let postData: any = {};
  if (req.body.data) {
    try {
      postData = JSON.parse(req.body.data);
    } catch (_err) {
      throw new Error("Invalid JSON in 'data' field");
    }
  } else {
    postData = req.body;
  }

  // 2️⃣ Upload files to Cloudinary if any
  const uploadedMedia: { url: string; type: string }[] = [];
  const files = req.files as Express.Multer.File[] | undefined;

  if (files && files.length > 0) {
    for (const file of files) {
      const uploadResult: any = await fileUploader.uploadToCloudinary(file);
      if (uploadResult) {
        uploadedMedia.push({
          url: uploadResult.secure_url,
          type: file.mimetype.startsWith("video/") ? "video" : "image",
        });
      }
    }
  }

  if (uploadedMedia.length > 0) {
    postData.media = uploadedMedia;
  }

  // 3️⃣ Create post
  const result = await postServices.createPostService(postData, currentUser.id);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Post created successfully!",
    data: result,
  });
});

/* ================= HOME FEED ================= */
const getHomeFeed = catchAsync(async (req: Request, res: Response) => {
  const result = await postServices.getHomeFeedService();

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Home feed fetched successfully!",
    data: result,
  });
});

/* ================= LIKE POST ================= */
const likePost = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to like a post");
  }

  const result = await postServices.likePostService(
    currentUser,
    req.params.id as string
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Post liked successfully!",
    data: result,
  });
});

/* ================= COMMENT POST ================= */
const commentPost = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to comment on a post");
  }

  const postId = req.params.id;
  const { text } = req.body as { text?: string };

  const result = await postServices.commentPostService(
    currentUser,
    postId as string,
    text || ""
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Comment added successfully!",
    data: result,
  });
});

/* ================= SEND GIFT ================= */
const sendGift = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to send a gift");
  }

  const result = await postServices.sendGiftService(
    currentUser,
    req.params.id as string,
    (req.body as any).giftType
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Gift sent successfully!",
    data: result,
  });
});

export const postController = {
  createPost,
  getHomeFeed,
  likePost,
  sendGift,
  commentPost,
};

