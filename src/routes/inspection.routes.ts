import { Router } from "express";
import * as inspectionController from "../controllers/inspection.controller";
import * as defectReportController from "../controllers/defectReport.controller";

const router = Router();

router.post("/generate-route", inspectionController.generateInspectionRoute);
router.get("/routes", inspectionController.getInspectionRoutes);
router.get("/routes/:id", inspectionController.getInspectionRoute);
router.put("/routes/:id", inspectionController.updateInspectionRoute);
router.delete("/routes/:id", inspectionController.deleteInspectionRoute);

router.get("/tasks", inspectionController.getInspectionTasks);
router.post("/tasks", inspectionController.createInspectionTask);
router.get("/tasks/:id", inspectionController.getInspectionTask);
router.put("/tasks/:id", inspectionController.updateInspectionTask);
router.delete("/tasks/:id", inspectionController.deleteInspectionTask);
router.post("/tasks/:id/start", inspectionController.startInspectionTask);
router.post("/tasks/:id/complete", inspectionController.completeInspectionTask);
router.get("/inspectors/:inspectorId/tasks", inspectionController.getInspectorTasks);

router.get("/statistics", inspectionController.getInspectionStatistics);

router.post("/defects", defectReportController.submitDefectReport);
router.get("/defects", defectReportController.getDefectReports);
router.get("/defects/:id", defectReportController.getDefectReport);
router.put("/defects/:id", defectReportController.updateDefectReport);
router.delete("/defects/:id", defectReportController.deleteDefectReport);
router.get("/defects/pipeline/:pipelineId", defectReportController.getDefectsByPipeline);
router.get("/defects/inspector/:inspectorId", defectReportController.getDefectsByInspector);
router.post("/defects/:id/link-work-order", defectReportController.linkDefectToWorkOrder);
router.post("/defects/:id/repair-status", defectReportController.updateDefectRepairStatus);
router.get("/defects/statistics", defectReportController.getDefectStatistics);

export default router;
