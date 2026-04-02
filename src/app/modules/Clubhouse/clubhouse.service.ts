/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Post, Comment, CategorySetting } from "./clubhouse.model";
import { ReportType, PostCategory } from "./clubhouse.interface ";
import { NotificationService } from "../notification/notification.service";

const getReplies = async (commentId: string): Promise<any[]> => {
  const replies = await Comment.find({ parentId: commentId })
    .populate("user", "firstName lastName profileImage skillLevel")
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
  const posts = await Post.find()
    .select("-reports")
    .populate("author", "firstName lastName profileImage skillLevel")
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

  if (!alreadyLiked) {
    const postWithAuthor = await Post.findById(postId).populate("author");
    if (postWithAuthor && postWithAuthor.author) {
      await NotificationService.notifyPostLiked(
        (postWithAuthor.author as any)._id.toString(),
        userId,
        user.firstName || user.name,
        postId
      );
    }
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

  const postWithAuthor = await Post.findById(postId).populate("author");
  if (postWithAuthor && postWithAuthor.author) {
    // We need to get the sender's name. We can find the user.
    const sender = await mongoose.model("User").findById(userId);
    await NotificationService.notifyPostCommented(
      (postWithAuthor.author as any)._id.toString(),
      userId,
      sender?.firstName || sender?.name || "Someone",
      postId
    );
  }

  return result;
};

export const getCommentsByPostService = async (postId: string): Promise<any[]> => {

  const comments = await Comment.find({
    post: postId,
    parentId: null,
  })
    .populate("user", "firstName lastName profileImage skillLevel")
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

export const getPostByIdService = async (postId: string): Promise<any> => {
  const post = await Post.findById(postId)
    .select("-reports")
    .populate("author", "firstName lastName profileImage skillLevel");

  if (!post) {
    throw new Error("Post not found");
  }

  return post;
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

export const reportPostService = async (
  postId: string,
  userId: string,
  type: ReportType
): Promise<any> => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  // Prevent duplicate report by same user
  const alreadyReported = post.reports.some(
    (r) => r.user.toString() === userId && r.type === type
  );
  if (alreadyReported) {
    throw new Error("You have already reported this post with this type");
  }
const userObjectId = new mongoose.Types.ObjectId(userId);
  // Add report
  post.reports.push({
    user: userObjectId,
    type,
    reportedAt: new Date(),
  });

  await post.save();

  return post.reports;
};

export const toggleCategorySettingService = async (
  category: string,
  isActive: boolean
): Promise<any> => {
  const result = await CategorySetting.findOneAndUpdate(
    { category },
    { isActive },
    { new: true, upsert: true }
  );
  return result;
};

export const getCategorySettingsService = async (): Promise<any> => {
  return await CategorySetting.find({});
};

export const getCategoryStatsService = async (): Promise<any> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const stats = await Post.aggregate([
    {
      $facet: {
        allTime: [
          {
            $group: {
              _id: '$category',
              totalPosts: { $sum: 1 },
              uniqueUsers: { $addToSet: '$author' }
            }
          }
        ],
        lastMonth: [
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$category',
              totalPosts: { $sum: 1 }
            }
          }
        ],
        prevMonth: [
          { $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$category',
              totalPosts: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  const { allTime, lastMonth, prevMonth } = stats[0];

  // Fetch all category settings to determine active status
  const categorySettings = await CategorySetting.find({});
  const allCategories = Object.values(PostCategory);

  const result = allCategories.map((category) => {
    const allTimeData = allTime.find((x: any) => x._id === category);
    const lmData = lastMonth.find((x: any) => x._id === category);
    const pmData = prevMonth.find((x: any) => x._id === category);

    const totalPosts = allTimeData ? allTimeData.totalPosts : 0;
    const totalUsers = allTimeData ? allTimeData.uniqueUsers.length : 0;

    const lastMonthCount = lmData ? lmData.totalPosts : 0;
    const prevMonthCount = pmData ? pmData.totalPosts : 0;

    let growth = 0;
    if (prevMonthCount > 0) {
      growth = ((lastMonthCount - prevMonthCount) / prevMonthCount) * 100;
    } else if (lastMonthCount > 0) {
      growth = 100;
    }

    // Default to true if not explicitly set to false
    const setting = categorySettings.find(s => s.category === category);
    const isActive = setting ? setting.isActive : true;

    return {
      category,
      totalPosts,
      totalUsers,
      growth: Math.round(growth * 100) / 100,
      isActive
    };
  });

  return result.sort((a: any, b: any) => b.totalPosts - a.totalPosts);
};

export const postServices = {
  createPostService,
  getHomeFeedService,
  getPostByIdService,
  likePostService,
  sendGiftService,
  createCommentService,
  getCommentsByPostService,
  likeCommentService,
  replyToCommentService,
  deletePostService,
  deleteCommentService,
  reportPostService,
  toggleCategorySettingService,
  getCategorySettingsService,
  getCategoryStatsService
};

