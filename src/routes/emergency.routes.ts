import { Router } from "express";
import * as emergencyController from "../controllers/emergency.controller";

const router = Router();

router.post("/valve-closure-plan", emergencyController.generateValveClosurePlan);
router.get("/valve-closure-plans", emergencyController.getValveClosurePlans);
router.get("/valve-closure-plans/:id", emergencyController.getValveClosurePlan);
router.get(
  "/valve-closure-plans/incident/:incidentId",
  emergencyController.getValveClosurePlanByIncident
);
router.post(
  "/valve-closure-plans/:id/steps/:stepId/execute",
  emergencyController.executeClosureStep
);
router.post("/valve-closure-plans/:id/complete", emergencyController.completeClosurePlan);
router.post("/calculate-isolation-area", emergencyController.calculateIsolationArea);
router.get("/valve-closure-plans/:planId/affected-users", emergencyController.estimateAffectedUsers);

export default router;
