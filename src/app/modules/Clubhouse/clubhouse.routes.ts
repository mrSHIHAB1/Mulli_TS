import { Router } from "express";
import { postController } from "./clubhouse.controller";
import { fileUploader } from "../../helpers/fileUpload";
import { checkAuth } from "../../middlewares/checkAuth";

const router = Router();

// Create post (with media upload) - requires auth
router.post(
  "/posts",
  checkAuth("user", "admin"),
  fileUploader.upload.array("media", 5),
  postController.createPost
);

// Public home feed (or restrict with checkAuth if needed)
router.get("/", postController.getHomeFeed);

// Interactions require auth
router.post("/like/:id", checkAuth("user", "admin"), postController.likePost);
router.post(
  "/comment/:id",
  checkAuth("user", "admin"),
  postController.commentPost
);
router.post(
  "/:id/gift",
  checkAuth("user", "admin"),
  postController.sendGift
);

export const clubhouseRoutes = router;

