import { Router } from "express";
import {
  createWorkOrderHandler,
  getWorkOrderHandler,
  updateWorkOrderHandler,
  deleteWorkOrderHandler,
  listWorkOrdersHandler,
  assignWorkOrderHandler,
  startWorkOrderHandler,
  completeWorkOrderHandler,
  acceptWorkOrderHandler,
  suspendWorkOrderHandler,
  closeWorkOrderHandler,
  getWorkOrdersByAssigneeHandler,
  getWorkOrdersByStatusHandler,
  getWorkOrderStatisticsHandler,
  addProgressHandler,
  getWorkOrderProgressHandler,
  updateProgressHandler,
  deleteProgressHandler,
  createWorkOrderFromAlertHandler,
  createWorkOrderFromDefectHandler,
  createWorkOrderFromHazardHandler,
} from "../controllers/workOrder.controller";

const router = Router();

router.post("/", createWorkOrderHandler);
router.get("/", listWorkOrdersHandler);
router.get("/statistics", getWorkOrderStatisticsHandler);
router.get("/assignee/:assigneeId", getWorkOrdersByAssigneeHandler);
router.get("/status/:status", getWorkOrdersByStatusHandler);
router.get("/:id", getWorkOrderHandler);
router.put("/:id", updateWorkOrderHandler);
router.delete("/:id", deleteWorkOrderHandler);

router.post("/:id/assign", assignWorkOrderHandler);
router.post("/:id/start", startWorkOrderHandler);
router.post("/:id/complete", completeWorkOrderHandler);
router.post("/:id/accept", acceptWorkOrderHandler);
router.post("/:id/suspend", suspendWorkOrderHandler);
router.post("/:id/close", closeWorkOrderHandler);

router.post("/:id/progress", addProgressHandler);
router.get("/:id/progress", getWorkOrderProgressHandler);
router.put("/:id/progress/:progressId", updateProgressHandler);
router.delete("/:id/progress/:progressId", deleteProgressHandler);

router.post("/from-alert", createWorkOrderFromAlertHandler);
router.post("/from-defect", createWorkOrderFromDefectHandler);
router.post("/from-hazard", createWorkOrderFromHazardHandler);

export default router;
