import { Router } from "express";
import * as riskAssessmentController from "../controllers/riskAssessment.controller";

const router = Router();

router.post("/", riskAssessmentController.createRiskAssessment);
router.get("/", riskAssessmentController.listRiskAssessments);
router.get("/statistics", riskAssessmentController.getRiskStatistics);
router.get("/history", riskAssessmentController.getRiskAssessmentHistory);
router.post("/assess-hazard", riskAssessmentController.assessHazardRisk);
router.post("/assess-pipeline", riskAssessmentController.assessPipelineRisk);
router.post("/batch-assess", riskAssessmentController.batchAssessRisks);
router.post("/calculate-score", riskAssessmentController.calculateRiskScore);
router.get("/:id", riskAssessmentController.getRiskAssessment);
router.put("/:id", riskAssessmentController.updateRiskAssessment);
router.delete("/:id", riskAssessmentController.deleteRiskAssessment);

export default router;
