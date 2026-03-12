import { Router } from "express";
import { Role } from "../user/user.interface";
import { NotificationController } from "./notification.controller";
import { checkAuth } from "../../middlewares/checkAuth";

const router = Router();

router.get(
  "/me",
  checkAuth(...Object.values(Role)),
  NotificationController.myNotifications,
);
router.patch(
  "/read/:notificationId",
  checkAuth(...Object.values(Role)),
  NotificationController.markRead,
);

router.patch(
  "/read-all",
  checkAuth(...Object.values(Role)),
  NotificationController.markAllRead,
);

router.delete(
  "/delete/:id",
  checkAuth(...Object.values(Role)),
  NotificationController.deleteNotificationController,  
);


export const notificationRoutes = router;
