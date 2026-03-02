import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { getDiscoveryUsers } from "./discovery.controller";

const router = Router();

// GET: discovery/matching users
router.get("/batch", checkAuth(...Object.values(Role)), getDiscoveryUsers);

export const discoveryRoutes = router;