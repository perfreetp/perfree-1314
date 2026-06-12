import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import {
  createSensor,
  getSensor,
  updateSensor,
  deleteSensor,
  listSensors,
  ingestSensorReading,
  getSensorReadings,
  getLatestReadings,
  getSensorStatistics,
  CreateSensorDto,
  UpdateSensorDto,
  IngestSensorReadingDto,
  SensorReadingFilters,
} from "../services/sensor.service";

export async function createSensorHandler(req: Request, res: Response) {
  const dto = req.body as CreateSensorDto;
  const userId = (req as any).user?.id;
  const sensor = await createSensor(dto, userId);
  return successResponse(res, sensor, "传感器创建成功");
}

export async function getSensorHandler(req: Request, res: Response) {
  const { id } = req.params;
  const sensor = await getSensor(id);
  return successResponse(res, sensor);
}

export async function updateSensorHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as UpdateSensorDto;
  const userId = (req as any).user?.id;
  const sensor = await updateSensor(id, dto, userId);
  return successResponse(res, sensor, "传感器更新成功");
}

export async function deleteSensorHandler(req: Request, res: Response) {
  const { id } = req.params;
  await deleteSensor(id);
  return successResponse(res, null, "传感器删除成功");
}

export async function listSensorsHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    type: req.query.type as any,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    departmentId: req.query.departmentId as string,
  };
  const result = await listSensors(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function ingestSensorReadingHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as IngestSensorReadingDto;
  const result = await ingestSensorReading(id, dto);
  return successResponse(res, result, "读数接入成功");
}

export async function getSensorReadingsHandler(req: Request, res: Response) {
  const { id } = req.params;
  const filters: SensorReadingFilters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
    isAnomaly: req.query.isAnomaly !== undefined ? req.query.isAnomaly === "true" : undefined,
  };
  const result = await getSensorReadings(id, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getLatestReadingsHandler(req: Request, res: Response) {
  const sensorIds = req.query.sensorIds
    ? (req.query.sensorIds as string).split(",")
    : undefined;
  const readings = await getLatestReadings(sensorIds);
  return successResponse(res, readings);
}

export async function getSensorStatisticsHandler(req: Request, res: Response) {
  const statistics = await getSensorStatistics();
  return successResponse(res, statistics);
}
