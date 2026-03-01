/* eslint-disable @typescript-eslint/no-explicit-any */
import { Post } from "./clubhouse.model";

export const createPostService = async (
  data: any,
  userId: string
): Promise<any> => {
  // make sure author in payload is ignored
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete data.author;

  const post = await Post.create({
    ...data,
    author: userId,
  });

  return post;
};

export const getHomeFeedService = async (): Promise<any[]> => {
  const posts = await Post.find({ visibility: "public" })
    .populate("author", "name profileImage")
    .sort({ createdAt: -1 });

  return posts;
};

export const likePostService = async (
  user: any,
  postId: string
): Promise<{ totalLikes: number; postId: string }> => {
  const post = await Post.findByIdAndUpdate(
    postId,
    { $addToSet: { likes: user.id } },
    { new: true }
  );

  if (!post) {
    throw new Error("Post not found");
  }

  return {
    totalLikes: post.likes.length,
    postId: post._id.toString(),
  };
};

export const commentPostService = async (
  user: any,
  postId: string,
  text: string
): Promise<any> => {
  const post = await Post.findById(postId);
  if (!post) throw new Error("Post not found");

  post.comments.push({
    user: user.id,
    text,
    createdAt: new Date(),
  });

  post.commentsCount = post.comments.length;

  await post.save();

  return {
    postId: post._id,
    totalComments: post.commentsCount,
    latestComment: post.comments[post.comments.length - 1],
  };
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

export const postServices = {
  createPostService,
  getHomeFeedService,
  likePostService,
  sendGiftService,
  commentPostService,
};

