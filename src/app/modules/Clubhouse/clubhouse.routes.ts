import { Router } from "express";
import { postController } from "./clubhouse.controller";
import { fileUploader } from "../../helpers/fileUpload";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { check } from "zod";

const router = Router();

// Create post (with media upload) - requires auth
router.post("/posts", checkAuth(...Object.values(Role)), fileUploader.upload.array("media", 5), postController.createPost);

// Public home feed (or restrict with checkAuth if needed)
router.get("/", postController.getHomeFeed);
router.get("/posts/:id", postController.getPostById);

// Interactions require auth
router.post("/like/:id", checkAuth(...Object.values(Role)), postController.likePost);
router.post("/:id/gift", checkAuth(...Object.values(Role)), postController.sendGift);

// New Comment Routes
router.post("/comment/:postId", checkAuth(...Object.values(Role)), postController.createComment);
router.get("/comment/:postId", postController.getComments);
router.post("/comment/like/:commentId", checkAuth(...Object.values(Role)), postController.likeComment);

router.post("/comments/reply/:commentId", checkAuth(...Object.values(Role)), postController.replyToComment);

// Delete Routes
router.delete("/post/:id", checkAuth(...Object.values(Role)), postController.deletePost);
router.delete("/comment/:id", checkAuth(...Object.values(Role)), postController.deleteComment);
router.post("/report/:postId",checkAuth(...Object.values(Role)), postController.reportPost);


router.patch("/category-setting/toggle", checkAuth(...Object.values(Role)), postController.toggleCategorySetting);
router.get("/category-setting", checkAuth(...Object.values(Role)), postController.getCategorySettings);

router.get("/category-stats", checkAuth(...Object.values(Role)), postController.getCategoryStats);

//follow post type
router.post("/followpost", checkAuth(...Object.values(Role)), postController.followPostType);
 router.post("/unfollowpost", checkAuth(...Object.values(Role)), postController.unfollowPostType);

export const clubhouseRoutes = router;

