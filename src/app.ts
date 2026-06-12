import "reflect-metadata";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Request, Response } from "express";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import departmentRoutes from "./routes/department.routes";
import pipelineRoutes from "./routes/pipeline.routes";
import facilityRoutes from "./routes/facility.routes";
import sensorRoutes from "./routes/sensor.routes";
import alertRoutes from "./routes/alert.routes";
import hazardRoutes from "./routes/hazard.routes";
import riskAssessmentRoutes from "./routes/riskAssessment.routes";
import excavationRoutes from "./routes/excavation.routes";
import emergencyRoutes from "./routes/emergency.routes";
import inspectionRoutes from "./routes/inspection.routes";
import workOrderRoutes from "./routes/work-order.routes";
import changeHistoryRoutes from "./routes/change-history.routes";
import sharingScopeRoutes from "./routes/sharing-scope.routes";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/facilities", facilityRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/hazards", hazardRoutes);
app.use("/api/risk-assessments", riskAssessmentRoutes);
app.use("/api/excavations", excavationRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/change-history", changeHistoryRoutes);
app.use("/api/sharing-scopes", sharingScopeRoutes);

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "服务运行正常",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
