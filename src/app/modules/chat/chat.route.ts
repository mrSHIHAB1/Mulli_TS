// app/modules/chat/chat.route.ts
import { Router } from "express";
import { ChatController } from "./chat.controller";
import { Role } from "../user/user.interface";
import { checkAuth } from "../../middlewares/checkAuth";
import { fileUploader } from "../../helpers/fileUpload";

const router = Router();

router.post(
  "/send_message/:receiverId",
  fileUploader.upload.array("media", 10),
  checkAuth(...Object.values(Role)),
  ChatController.sendMessage,
);

router.get(
  "/conversations",
  checkAuth(...Object.values(Role)),
  ChatController.getConversations,
);

router.get(
  "/messages/:otherUserId",
  checkAuth(...Object.values(Role)),
  ChatController.getMessages,
);
router.delete("/message/:messageId", checkAuth(...Object.values(Role)), ChatController.deleteMessage);

export const chatRoutes = router;
