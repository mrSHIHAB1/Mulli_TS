/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { fileUploader } from "../../helpers/fileUpload";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { postServices } from "./clubhouse.service";

/* ================= CREATE POST ================= */
const createPost = catchAsync(async (req: Request, res: Response) => {

  const currentUser: any = (req as any).user;



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


  const uploadedMedia: string[] = [];
  const files = req.files as Express.Multer.File[] | undefined;

  if (files && files.length > 0) {
    for (const file of files) {
      const uploadResult: any = await fileUploader.uploadToCloudinary(file);
      if (uploadResult) {
        uploadedMedia.push(uploadResult.secure_url);
      }
    }
  }

  if (uploadedMedia.length > 0) {
    postData.media = uploadedMedia;
  }


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
const createComment = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to comment on a post");
  }

  const { postId } = req.params;

  const result = await postServices.createCommentService(
    currentUser.id,
    postId as string,
    req.body
  );

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Comment added successfully!",
    data: result,
  });
});

/* ================= GET COMMENTS ================= */
const getComments = catchAsync(async (req: Request, res: Response) => {
  const result = await postServices.getCommentsByPostService(
    req.params.postId as string
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Comments fetched successfully!",
    data: result,
  });
});

/* ================= LIKE COMMENT ================= */
const likeComment = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  if (!currentUser?.id) {
    throw new Error("Authenticated user required to like a comment");
  }

  const result = await postServices.likeCommentService(
    currentUser.id,
    req.params.commentId as string
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Comment liked successfully!",
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

const replyToComment = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;


  const { commentId } = req.params;

  const result = await postServices.replyToCommentService(
    currentUser.id,
    commentId as string,
    req.body
  );

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Reply added successfully!",
    data: result,
  });
});

const deletePost = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  const { id } = req.params;

  const result = await postServices.deletePostService(id as string, currentUser.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Post deleted successfully!",
    data: result,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const currentUser: any = (req as any).user;
  const { id } = req.params;

  const result = await postServices.deleteCommentService(id as string, currentUser.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Comment deleted successfully!",
    data: result,
  });
});

export const postController = {
  createPost,
  getHomeFeed,
  likePost,
  sendGift,
  createComment,
  getComments,
  likeComment,
  replyToComment,
  deletePost,
  deleteComment
};

