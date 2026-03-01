import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { getHomeProfiles } from "./discovery.controller";

const router = Router();

// GET: discovery feed with optional query filters
router.get("/batch", checkAuth("user", "admin"), getHomeProfiles);

export const discoveryRoutes = router;

