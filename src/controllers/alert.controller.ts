import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import {
  createAlert,
  getAlert,
  updateAlert,
  deleteAlert,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertStatistics,
  createWorkOrderFromAlert,
  CreateAlertDto,
  UpdateAlertDto,
  CreateWorkOrderFromAlertDto,
} from "../services/alert.service";

export async function createAlertHandler(req: Request, res: Response) {
  const dto = req.body as CreateAlertDto;
  const userId = (req as any).user?.id;
  const alert = await createAlert(dto, userId);
  return successResponse(res, alert, "告警创建成功");
}

export async function getAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  const alert = await getAlert(id);
  return successResponse(res, alert);
}

export async function updateAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as UpdateAlertDto;
  const userId = (req as any).user?.id;
  const alert = await updateAlert(id, dto, userId);
  return successResponse(res, alert, "告警更新成功");
}

export async function deleteAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  await deleteAlert(id);
  return successResponse(res, null, "告警删除成功");
}

export async function listAlertsHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    type: req.query.type as any,
    severity: req.query.severity as any,
    status: req.query.status as any,
    sensorId: req.query.sensorId as string,
    startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
    sharingLevel: req.query.sharingLevel as any,
  };
  const result = await listAlerts(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function acknowledgeAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const alert = await acknowledgeAlert(id, userId);
  return successResponse(res, alert, "告警已确认");
}

export async function resolveAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { resolutionNotes } = req.body;
  const userId = (req as any).user?.id;
  const alert = await resolveAlert(id, resolutionNotes, userId);
  return successResponse(res, alert, "告警已消除");
}

export async function getActiveAlertsHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    severity: req.query.severity as any,
  };
  const result = await getActiveAlerts(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getAlertStatisticsHandler(req: Request, res: Response) {
  const statistics = await getAlertStatistics();
  return successResponse(res, statistics);
}

export async function createWorkOrderFromAlertHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as CreateWorkOrderFromAlertDto;
  const userId = (req as any).user?.id;
  const workOrder = await createWorkOrderFromAlert(id, dto, userId);
  return successResponse(res, workOrder, "工单创建成功");
}
