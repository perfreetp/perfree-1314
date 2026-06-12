import { Router } from "express";
import * as facilityController from "../controllers/facility.controller";

const router = Router();

router.post("/", facilityController.create);
router.get("/", facilityController.list);
router.get("/statistics", facilityController.getStatistics);
router.get("/valves", facilityController.getValves);
router.get("/manholes", facilityController.getManholes);
router.get("/type/:type", facilityController.listByType);
router.get("/pipeline/:pipelineId", facilityController.listByPipeline);
router.post("/geometry", facilityController.queryByGeometry);
router.get("/:id", facilityController.getById);
router.put("/:id", facilityController.update);
router.delete("/:id", facilityController.remove);
router.post("/:id/valve-status", facilityController.updateValveStatusController);
router.post("/:id/accessibility", facilityController.checkAccessibility);
router.get("/:id/maintenance-history", facilityController.getHistory);

export default router;
