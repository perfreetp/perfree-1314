import { Router } from "express";
import * as hazardController from "../controllers/hazard.controller";

const router = Router();

router.post("/", hazardController.createHazard);
router.get("/", hazardController.listHazards);
router.get("/statistics", hazardController.getHazardStatistics);
router.post("/batch-import", hazardController.batchImportHazards);
router.post("/geometry", hazardController.getHazardsByGeometry);
router.get("/pipeline/:pipelineId", hazardController.getHazardsByPipeline);
router.get("/:id", hazardController.getHazard);
router.put("/:id", hazardController.updateHazard);
router.delete("/:id", hazardController.deleteHazard);
router.post("/:id/annotate", hazardController.annotateHazard);
router.post("/:id/repair-status", hazardController.updateRepairStatus);
router.post("/:id/link-work-order", hazardController.linkHazardToWorkOrder);

export default router;
