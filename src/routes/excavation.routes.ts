import { Router } from "express";
import * as excavationController from "../controllers/excavation.controller";
import * as conflictController from "../controllers/conflict.controller";
import * as roadImpactController from "../controllers/roadImpact.controller";

const router = Router();

router.post("/", excavationController.createExcavation);
router.get("/", excavationController.listExcavations);
router.get("/statistics", excavationController.getApplicationStatistics);
router.get("/:id", excavationController.getExcavation);
router.put("/:id", excavationController.updateExcavation);
router.delete("/:id", excavationController.deleteExcavation);
router.post("/:id/submit", excavationController.submitApplication);
router.post("/:id/review", excavationController.reviewApplication);
router.post("/:id/verify", excavationController.verifyExcavationSafety);
router.post("/:id/complete", excavationController.completeApplication);
router.get("/status/:status", excavationController.getApplicationsByStatus);
router.get("/department/:departmentId", excavationController.getApplicationsByDepartment);

router.get("/:id/conflicts", conflictController.getConflictsByApplication);
router.post("/:id/conflicts/detect", conflictController.detectConflicts);
router.post("/conflicts/:id/resolve", conflictController.resolveConflict);
router.get("/conflicts/statistics", conflictController.getConflictStatistics);

router.get("/:id/road-impacts", roadImpactController.getRoadImpactsByApplication);
router.post("/:id/calculate-impact", roadImpactController.calculateRoadImpact);
router.get("/:id/traffic-impact", roadImpactController.assessTrafficImpact);
router.get("/:id/detour-suggestions", roadImpactController.generateDetourSuggestions);
router.get("/road-impacts/statistics", roadImpactController.getAffectedRoadsStatistics);

export default router;
