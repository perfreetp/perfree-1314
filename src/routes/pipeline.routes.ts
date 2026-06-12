import { Router } from "express";
import * as pipelineController from "../controllers/pipeline.controller";

const router = Router();

router.post("/", pipelineController.createPipeline);
router.get("/", pipelineController.listPipelines);
router.get("/statistics", pipelineController.getPipelineStatistics);
router.get("/section-occupancy", pipelineController.getSectionOccupancy);
router.post("/geometry", pipelineController.getPipelinesByGeometry);
router.post("/calculate-risk", pipelineController.calculateRiskScore);
router.get("/:id", pipelineController.getPipeline);
router.put("/:id", pipelineController.updatePipeline);
router.delete("/:id", pipelineController.deletePipeline);
router.get("/:id/upstream", pipelineController.getUpstreamPipelines);
router.get("/:id/downstream", pipelineController.getDownstreamPipelines);
router.get("/:id/connected", pipelineController.getConnectedPipelines);
router.get("/:id/age", pipelineController.calculatePipelineAge);

export default router;
