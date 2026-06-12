import { Router } from "express";
import {
  createAlertHandler,
  getAlertHandler,
  updateAlertHandler,
  deleteAlertHandler,
  listAlertsHandler,
  acknowledgeAlertHandler,
  resolveAlertHandler,
  getActiveAlertsHandler,
  getAlertStatisticsHandler,
  createWorkOrderFromAlertHandler,
} from "../controllers/alert.controller";

const router = Router();

router.post("/", createAlertHandler);
router.get("/", listAlertsHandler);
router.get("/active", getActiveAlertsHandler);
router.get("/statistics", getAlertStatisticsHandler);
router.get("/:id", getAlertHandler);
router.put("/:id", updateAlertHandler);
router.delete("/:id", deleteAlertHandler);
router.post("/:id/acknowledge", acknowledgeAlertHandler);
router.post("/:id/resolve", resolveAlertHandler);
router.post("/:id/work-order", createWorkOrderFromAlertHandler);

export default router;
