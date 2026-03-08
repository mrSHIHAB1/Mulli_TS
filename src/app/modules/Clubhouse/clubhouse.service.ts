/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Post, Comment } from "./clubhouse.model";

const getReplies = async (commentId: string): Promise<any[]> => {
  const replies = await Comment.find({ parentId: commentId })
    .populate("user", "name profileImage skillLevel")
    .sort({ createdAt: 1 });

  const nestedReplies = await Promise.all(
    replies.map(async (reply) => {
      const children = await getReplies(reply._id.toString());

      return {
        ...reply.toJSON(),
        replies: children,
      };
    })
  );

  return nestedReplies;
};


export const createPostService = async (
  data: any,
  userId: string
): Promise<any> => {

  delete data.author;

  const post = await Post.create({
    ...data,
    author: userId,
  });

  return post;
};

export const getHomeFeedService = async (): Promise<any[]> => {
  const posts = await Post.find({ visibility: "public" })
    .populate("author", "name profileImage skillLevel")
    .sort({ createdAt: -1 });

  return posts;
};

export const likePostService = async (
  user: any,
  postId: string
): Promise<{ totalLikes: number; liked: boolean }> => {

  const post = await Post.findById(postId);
  if (!post) throw new Error("Post not found");

  const userId = user.id.toString();

  const alreadyLiked = post.likes.some(
    (id: any) => id.toString() === userId
  );

  let updatedPost;

  if (alreadyLiked) {

    updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $pull: { likes: userId },
        $inc: { likesCount: -1 }
      },
      { new: true }
    );
  } else {

    updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 }
      },
      { new: true }
    );
  }
  if (updatedPost!.likesCount < 0) {
    updatedPost!.likesCount = 0;
    await updatedPost!.save();
  }

  return {
    totalLikes: updatedPost!.likesCount,
    liked: !alreadyLiked,
  };
};

export const createCommentService = async (
  userId: string,
  postId: string,
  payload: any
): Promise<any> => {
  const { text } = payload;

  const isPostExist = await Post.findById(postId);
  if (!isPostExist) {
    throw new Error("Post not found");
  }

  const result = await Comment.create({
    user: userId,
    post: postId,
    text,

  });

  // Increment comment count in Post
  await Post.findByIdAndUpdate(postId, {
    $inc: { commentsCount: 1 },
  });

  return result;
};

export const getCommentsByPostService = async (postId: string): Promise<any[]> => {

  const comments = await Comment.find({
    post: postId,
    parentId: null,
  })
    .populate("user", "name profileImage skillLevel")
    .sort({ createdAt: -1 });

  const result = await Promise.all(
    comments.map(async (comment) => {
      const replies = await getReplies(comment._id.toString());

      return {
        ...comment.toJSON(),
        replies,
      };
    })
  );

  return result;
};

export const likeCommentService = async (
  userId: string,
  commentId: string
): Promise<any> => {

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const isLiked = comment.likes.some((id) => id.equals(userObjectId));

  let updatedComment;

  if (isLiked) {
    updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $pull: { likes: userObjectId },
        $inc: { likesCount: -1 },
      },
      { new: true }
    ).populate("user", "name profileImage");
  } else {

    updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $addToSet: { likes: userObjectId },
        $inc: { likesCount: 1 },
      },
      { new: true }
    ).populate("user", "name profileImage");
  }

  return updatedComment;
};

export const sendGiftService = async (
  user: any,
  postId: string,
  giftType: string
): Promise<any> => {
  const updated = await Post.findByIdAndUpdate(
    postId,
    {
      $push: {
        gifts: { user: user.id, giftType, sentAt: new Date() },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Post not found");
  }

  return updated;
};
export const replyToCommentService = async (
  userId: string,
  commentId: string,
  payload: any
): Promise<any> => {
  const { text } = payload;
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    throw new Error("Parent comment not found");
  }
  const reply = await Comment.create({
    user: userId,
    post: parentComment.post,
    text,
    parentId: parentComment._id,
  });
  await Comment.findByIdAndUpdate(commentId, {
    $inc: { replyCount: 1 },
  });
  return reply;
};

export const deletePostService = async (
  postId: string,
  userId: string
): Promise<any> => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  if (post.author.toString() !== userId) {
    throw new Error("You are not authorized to delete this post");
  }

  // Delete all comments associated with the post
  await Comment.deleteMany({ post: postId });

  const result = await Post.findByIdAndDelete(postId);
  return result;
};

export const deleteCommentService = async (
  commentId: string,
  userId: string
): Promise<any> => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.user.toString() !== userId) {
    throw new Error("You are not authorized to delete this comment");
  }

  // If it's a reply, decrement replyCount of parent
  if (comment.parentId) {
    await Comment.findByIdAndUpdate(comment.parentId, {
      $inc: { replyCount: -1 },
    });
  } else {
    // If it's a top-level comment, decrement commentsCount of post
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 },
    });
  }

  // Delete all replies if any
  await Comment.deleteMany({ parentId: commentId });

  const result = await Comment.findByIdAndDelete(commentId);
  return result;
};

export const postServices = {
  createPostService,
  getHomeFeedService,
  likePostService,
  sendGiftService,
  createCommentService,
  getCommentsByPostService,
  likeCommentService,
  replyToCommentService,
  deletePostService,
  deleteCommentService
};

