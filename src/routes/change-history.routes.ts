import { Router } from "express";
import {
  getChangeHistory,
  listChangeHistories,
  getChangeStatistics,
  recordChange,
  restoreVersion,
  compareEntities,
} from "../controllers/changeHistory.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware());

router.get("/", listChangeHistories);
router.post("/", recordChange);
router.get("/statistics", getChangeStatistics);
router.post("/compare", compareEntities);
router.get("/:entityType/:entityId", getChangeHistory);
router.post("/:id/restore", restoreVersion);

export default router;
