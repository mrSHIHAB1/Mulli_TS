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

// Interactions require auth
router.post("/like/:id", checkAuth(...Object.values(Role)), postController.likePost);
router.post("/:id/gift", checkAuth(...Object.values(Role)), postController.sendGift);

// New Comment Routes
router.post("/comment/:postId", checkAuth(...Object.values(Role)), postController.createComment);
router.get("/comment/:postId", postController.getComments);
router.post("/comment/like/:commentId", checkAuth(...Object.values(Role)), postController.likeComment);

router.post("/comments/reply/:commentId", checkAuth(...Object.values(Role)), postController.replyToComment);

// Delete Routes
router.delete("/posts/:id", checkAuth(...Object.values(Role)), postController.deletePost);
router.delete("/comment/:id", checkAuth(...Object.values(Role)), postController.deleteComment);
router.post("/report/:postId",checkAuth(...Object.values(Role)), postController.reportPost);

export const clubhouseRoutes = router;

