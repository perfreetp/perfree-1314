import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import {
  createWorkOrder,
  getWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  listWorkOrders,
  assignWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  acceptWorkOrder,
  suspendWorkOrder,
  closeWorkOrder,
  getWorkOrdersByAssignee,
  getWorkOrdersByStatus,
  getWorkOrdersByPipeline,
  getWorkOrderStatistics,
  createWorkOrderFromAlert,
  createWorkOrderFromDefect,
  createWorkOrderFromHazard,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  AssignWorkOrderDto,
  CompleteWorkOrderDto,
  AcceptWorkOrderDto,
  SuspendWorkOrderDto,
} from "../services/workOrder.service";
import {
  addProgress,
  getWorkOrderProgress,
  updateProgress,
  deleteProgress,
  AddProgressDto,
  UpdateProgressDto,
} from "../services/workOrderProgress.service";
import { WorkOrderStatus } from "../types/enums";

export async function createWorkOrderHandler(req: Request, res: Response) {
  const dto = req.body as CreateWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await createWorkOrder(dto, userId);
  return successResponse(res, workOrder, "工单创建成功");
}

export async function getWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const workOrder = await getWorkOrder(id);
  return successResponse(res, workOrder);
}

export async function updateWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as UpdateWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await updateWorkOrder(id, dto, userId);
  return successResponse(res, workOrder, "工单更新成功");
}

export async function deleteWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  await deleteWorkOrder(id, userId);
  return successResponse(res, null, "工单删除成功");
}

export async function listWorkOrdersHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    status: req.query.status as WorkOrderStatus | undefined,
    priority: req.query.priority as any,
    workType: req.query.workType as string | undefined,
    pipelineId: req.query.pipelineId as string | undefined,
    facilityId: req.query.facilityId as string | undefined,
    assigneeId: req.query.assigneeId as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
    createdBy: req.query.createdBy as string | undefined,
    startTime: req.query.startTime
      ? new Date(req.query.startTime as string)
      : undefined,
    endTime: req.query.endTime
      ? new Date(req.query.endTime as string)
      : undefined,
    sharingLevel: req.query.sharingLevel as any,
  };
  const result = await listWorkOrders(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function assignWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as AssignWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await assignWorkOrder(id, dto, userId);
  return successResponse(res, workOrder, "工单派单成功");
}

export async function startWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  const workOrder = await startWorkOrder(id, userId);
  return successResponse(res, workOrder, "工单已开始处理");
}

export async function completeWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as CompleteWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await completeWorkOrder(id, dto, userId);
  return successResponse(res, workOrder, "工单已完成");
}

export async function acceptWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as AcceptWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await acceptWorkOrder(id, dto, userId);
  return successResponse(res, workOrder, "工单验收通过");
}

export async function suspendWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as SuspendWorkOrderDto;
  const userId = (req as any).user?.id;
  const workOrder = await suspendWorkOrder(id, dto, userId);
  return successResponse(res, workOrder, "工单已暂停");
}

export async function closeWorkOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { remarks } = req.body;
  const userId = (req as any).user?.id;
  const workOrder = await closeWorkOrder(id, remarks, userId);
  return successResponse(res, workOrder, "工单已关闭");
}

export async function getWorkOrdersByAssigneeHandler(
  req: Request,
  res: Response
) {
  const { assigneeId } = req.params;
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    status: req.query.status as WorkOrderStatus | undefined,
  };
  const result = await getWorkOrdersByAssignee(assigneeId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getWorkOrdersByStatusHandler(
  req: Request,
  res: Response
) {
  const { status } = req.params;
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    priority: req.query.priority as any,
  };
  const result = await getWorkOrdersByStatus(
    status as WorkOrderStatus,
    filters
  );
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getWorkOrderStatisticsHandler(
  req: Request,
  res: Response
) {
  const statistics = await getWorkOrderStatistics();
  return successResponse(res, statistics);
}

export async function addProgressHandler(req: Request, res: Response) {
  const { id } = req.params;
  const dto = req.body as AddProgressDto;
  const userId = (req as any).user?.id;
  const progress = await addProgress(id, dto, userId);
  return successResponse(res, progress, "进度记录添加成功");
}

export async function getWorkOrderProgressHandler(
  req: Request,
  res: Response
) {
  const { id } = req.params;
  const progress = await getWorkOrderProgress(id);
  return successResponse(res, progress);
}

export async function updateProgressHandler(req: Request, res: Response) {
  const { id, progressId } = req.params;
  const dto = req.body as UpdateProgressDto;
  const userId = (req as any).user?.id;
  const progress = await updateProgress(id, progressId, dto, userId);
  return successResponse(res, progress, "进度记录更新成功");
}

export async function deleteProgressHandler(req: Request, res: Response) {
  const { id, progressId } = req.params;
  await deleteProgress(id, progressId);
  return successResponse(res, null, "进度记录删除成功");
}

export async function createWorkOrderFromAlertHandler(
  req: Request,
  res: Response
) {
  const { alertId } = req.body;
  const dto = req.body as Partial<CreateWorkOrderDto> & { assigneeId?: string };
  const userId = (req as any).user?.id;
  const workOrder = await createWorkOrderFromAlert(alertId, dto, userId);
  return successResponse(res, workOrder, "从告警创建工单成功");
}

export async function createWorkOrderFromDefectHandler(
  req: Request,
  res: Response
) {
  const { defectReportId } = req.body;
  const dto = req.body as Partial<CreateWorkOrderDto> & { assigneeId?: string };
  const userId = (req as any).user?.id;
  const workOrder = await createWorkOrderFromDefect(
    defectReportId,
    dto,
    userId
  );
  return successResponse(res, workOrder, "从缺陷创建工单成功");
}

export async function createWorkOrderFromHazardHandler(
  req: Request,
  res: Response
) {
  const { hazardId } = req.body;
  const dto = req.body as Partial<CreateWorkOrderDto> & { assigneeId?: string };
  const userId = (req as any).user?.id;
  const workOrder = await createWorkOrderFromHazard(hazardId, dto, userId);
  return successResponse(res, workOrder, "从隐患创建工单成功");
}
