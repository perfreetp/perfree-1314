import { Router } from "express";
import {
  createSensorHandler,
  getSensorHandler,
  updateSensorHandler,
  deleteSensorHandler,
  listSensorsHandler,
  ingestSensorReadingHandler,
  getSensorReadingsHandler,
  getLatestReadingsHandler,
  getSensorStatisticsHandler,
} from "../controllers/sensor.controller";

const router = Router();

router.post("/", createSensorHandler);
router.get("/", listSensorsHandler);
router.get("/statistics", getSensorStatisticsHandler);
router.get("/readings/latest", getLatestReadingsHandler);
router.get("/:id", getSensorHandler);
router.put("/:id", updateSensorHandler);
router.delete("/:id", deleteSensorHandler);
router.post("/:id/readings", ingestSensorReadingHandler);
router.get("/:id/readings", getSensorReadingsHandler);

export default router;
