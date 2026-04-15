/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { Post, Comment, CategorySetting, ClubhouseFollow } from "./clubhouse.model";
import { ReportType, PostCategory, ReactionType } from "./clubhouse.interface ";
import Subscription from "../subscription/subscription.model";
import User from "../user/user.model";
import { Plan, SUBSCRIPTION_PLANS } from "../../config/subscriptionPlans";
import { SubscriptionStatus } from "../subscription/subscription.interface";

import { NotificationService } from "../notification/notification.service";
import {
  onPostCreated,
  onPostDeleted,
  onReactionGiven,
  onCommentCreated,
  onCommentDeleted,
  onReplyCreated,
  onReplyDeleted,
  checkCommentMilestone,
  getClubhouseProfile,
} from "./clubhouse.points";

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

  // Award points for post creation
  await onPostCreated(userId);

  return post;
};

export const getHomeFeedService = async (): Promise<any[]> => {
  const posts = await Post.find()
    .select("-reports")
    .populate("author", "firstName lastName profileImage skillLevel")
    .populate("reactions.user", "firstName lastName profileImage")
    .sort({ boostedAt: -1, createdAt: -1 });

  return posts;
};


export const reactPostService = async (
  user: any,
  postId: string,
  reactionType: ReactionType = ReactionType.LIKE
): Promise<{ reactionCount: any; reacted: boolean }> => {

  const post = await Post.findById(postId);
  if (!post) throw new Error("Post not found");

  const userId = user.id.toString();

  if (!post.reactionCount) {
    post.reactionCount = { like: 0, fire: 0, haha: 0 };
  }

  const existingReactionIndex = post.reactions.findIndex(
    (r: any) => r.user.toString() === userId
  );

  let reacted = false;
  let oldReactionType: ReactionType | null = null;
  let newReactionType: ReactionType | null = null;

  if (existingReactionIndex !== -1) {
    const existingReaction = post.reactions[existingReactionIndex];
    const oldType = existingReaction.type;
    oldReactionType = oldType;

    // Remove old reaction count
    (post.reactionCount as any)[oldType] = Math.max(0, (post.reactionCount as any)[oldType] - 1);

    if (oldType === reactionType) {
      // Toggle off
      post.reactions.splice(existingReactionIndex, 1);
      reacted = false;
      newReactionType = null;
    } else {
      // Change reaction type
      existingReaction.type = reactionType;
      (post.reactionCount as any)[reactionType] = ((post.reactionCount as any)[reactionType] || 0) + 1;
      reacted = true;
      newReactionType = reactionType;
    }
  } else {
    // New reaction
    post.reactions.push({ user: new mongoose.Types.ObjectId(userId), type: reactionType } as any);
    (post.reactionCount as any)[reactionType] = ((post.reactionCount as any)[reactionType] || 0) + 1;
    reacted = true;
    newReactionType = reactionType;
    oldReactionType = null;
  }

  await post.save();

  const postAuthorId = post.author.toString();

  if (reacted) {
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

  // Award or deduct points based on old/new reaction state
  await onReactionGiven(userId, postAuthorId, newReactionType, oldReactionType);

  return {
    reactionCount: post.reactionCount,
    reacted,
  };
};

export const createCommentService = async (
  userId: string,
  postId: string,
  payload: any
): Promise<any> => {
  const { text } = payload;

  // Single query: increment count and get updated post with author in one shot
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { $inc: { commentsCount: 1 } },
    { new: true }
  ).populate("author");

  if (!updatedPost) throw new Error("Post not found");

  const result = await Comment.create({ user: userId, post: postId, text });

  if (updatedPost.author) {
    const postAuthorId = (updatedPost.author as any)._id.toString();
    const sender = await mongoose.model("User").findById(userId);
    await NotificationService.notifyPostCommented(
      postAuthorId,
      userId,
      sender?.firstName || sender?.name || "Someone",
      postId
    );

    await onCommentCreated(userId, postAuthorId, postId);
    await checkCommentMilestone(postAuthorId, updatedPost.commentsCount, postId);
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

export const reactCommentService = async (
  userId: string,
  commentId: string,
  reactionType: ReactionType = ReactionType.LIKE
): Promise<any> => {

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (!comment.reactionCount) {
    comment.reactionCount = { like: 0, fire: 0, haha: 0 };
  }

  const existingReactionIndex = comment.reactions.findIndex(
    (r: any) => r.user.toString() === userId
  );

  let oldReactionType: ReactionType | null = null;
  let newReactionType: ReactionType | null = null;

  if (existingReactionIndex !== -1) {
    const existingReaction = comment.reactions[existingReactionIndex];
    const oldType = existingReaction.type;
    oldReactionType = oldType;

    // Remove old reaction count
    (comment.reactionCount as any)[oldType] = Math.max(0, (comment.reactionCount as any)[oldType] - 1);

    if (oldType === reactionType) {
      // Toggle off
      comment.reactions.splice(existingReactionIndex, 1);
      newReactionType = null;
    } else {
      // Change reaction type
      existingReaction.type = reactionType;
      (comment.reactionCount as any)[reactionType] = ((comment.reactionCount as any)[reactionType] || 0) + 1;
      newReactionType = reactionType;
    }
  } else {
    // New reaction
    comment.reactions.push({ user: new mongoose.Types.ObjectId(userId), type: reactionType } as any);
    (comment.reactionCount as any)[reactionType] = ((comment.reactionCount as any)[reactionType] || 0) + 1;
    newReactionType = reactionType;
    oldReactionType = null;
  }

  await comment.save();

  // Award or deduct points based on old/new reaction state
  const commentAuthorId = comment.user.toString();
  await onReactionGiven(userId, commentAuthorId, newReactionType, oldReactionType);

  return comment.populate("user", "name profileImage");
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
  )
    .populate("author", "firstName lastName profileImage skillLevel")
    .populate("reactions.user", "firstName lastName profileImage");

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

  // Award points for reply
  await onReplyCreated(
    userId,
    parentComment.user.toString(),
    parentComment.post.toString()
  );

  return reply;
};

export const getPostByIdService = async (postId: string): Promise<any> => {
  const post = await Post.findById(postId)
    .select("-reports")
    .populate("author", "firstName lastName profileImage skillLevel")
    .populate("reactions.user", "firstName lastName profileImage");

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

  // Reverse post-creation points before deletion
  await onPostDeleted(userId);

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

  const postId = comment.post.toString();
  const commenterId = comment.user.toString();

  if (comment.parentId) {
    // It's a reply — reverse reply points before deletion
    const parentComment = await Comment.findById(comment.parentId);
    if (parentComment) {
      await onReplyDeleted(commenterId, parentComment.user.toString(), postId);
    }
    await Comment.findByIdAndUpdate(comment.parentId, {
      $inc: { replyCount: -1 },
    });
  } else {
    // It's a top-level comment
    // First reverse points for all replies that will be bulk-deleted
    const replies = await Comment.find({ parentId: commentId });
    for (const reply of replies) {
      await onReplyDeleted(reply.user.toString(), commenterId, postId);
    }

    // Reverse the comment's own points
    const post = await Post.findById(postId);
    if (post) {
      await onCommentDeleted(commenterId, post.author.toString(), postId);
    }

    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });
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
export const followPostTypeService = async (userId: string, postType: string): Promise<any> => {
  const existing = await ClubhouseFollow.findOne({ user: userId, postType });

  if (existing) {
    throw new Error("You are already following this post type");
  }

  const result = await ClubhouseFollow.create({ user: userId, postType });
  return result;
};

export const unfollowPostTypeService = async (userId: string, postType: string): Promise<any> => {
  const result = await ClubhouseFollow.deleteOne({ user: userId, postType });
  return result;
};

export const getClubhouseProfileService = async (userId: string): Promise<any> => {
  return getClubhouseProfile(userId);
};



export const boostPostService = async (
  userId: string,
  postId: string
): Promise<any> => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const post = await Post.findById(postId);
  if (!post) throw new Error("Post not found");

  if (post.author.toString() !== userId) {
    throw new Error("You can only boost your own posts");
  }

  // 1. Determine User's Plan
  const activeSub = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.ACTIVE,
  });

  const plan = (activeSub?.plan_type as Plan) || Plan.FREE;
  const planConfig = SUBSCRIPTION_PLANS[plan];
  const boostLimit = planConfig.clubhouseBoosts;

  if (boostLimit === 0) {
    throw new Error("Your current plan does not include post boosts");
  }

  // 2. Handle Monthly Reset
  const now = new Date();
  const lastReset = user.lastClubhouseBoostResetDate || now;
  const isNewMonth = 
    now.getMonth() !== lastReset.getMonth() || 
    now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    user.clubhouseBoostsUsedThisMonth = 0;
    user.lastClubhouseBoostResetDate = now;
  }

  // 3. Check Limit (if not unlimited)
  if (boostLimit !== -1) {
    if ((user.clubhouseBoostsUsedThisMonth || 0) >= boostLimit) {
      throw new Error(`You have reached your limit of ${boostLimit} boosts for this month`);
    }
  }

  // 4. Apply Boost
  post.boostedAt = now;
  await post.save();

  user.clubhouseBoostsUsedThisMonth = (user.clubhouseBoostsUsedThisMonth || 0) + 1;
  await user.save();

  // Return boosted post with populated reactions user details
  const boostedPost = await Post.findById(postId)
    .populate("author", "firstName lastName profileImage skillLevel")
    .populate("reactions.user", "firstName lastName profileImage");

  return boostedPost;
};

export const postServices = {

  createPostService,
  getHomeFeedService,
  getPostByIdService,
  reactPostService,
  sendGiftService,
  createCommentService,
  getCommentsByPostService,
  reactCommentService,
  replyToCommentService,
  deletePostService,
  deleteCommentService,
  reportPostService,
  toggleCategorySettingService,
  getCategorySettingsService,
  getCategoryStatsService,
  followPostTypeService,
  unfollowPostTypeService,
  getClubhouseProfileService,
  boostPostService,
};


