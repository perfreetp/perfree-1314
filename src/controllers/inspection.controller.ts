import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as inspectionService from "../services/inspection.service";

export async function generateInspectionRoute(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const route = await inspectionService.generateInspectionRoute(req.body, userId);
  return successResponse(res, route, "巡检路线生成成功");
}

export async function getInspectionRoute(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("路线ID不能为空", 400);
  }
  const route = await inspectionService.getInspectionRoute(id);
  return successResponse(res, route, "查询成功");
}

export async function updateInspectionRoute(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  if (!id) {
    throwApiError("路线ID不能为空", 400);
  }
  const route = await inspectionService.updateInspectionRoute(id, req.body, userId);
  return successResponse(res, route, "巡检路线更新成功");
}

export async function deleteInspectionRoute(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("路线ID不能为空", 400);
  }
  await inspectionService.deleteInspectionRoute(id);
  return successResponse(res, null, "巡检路线删除成功");
}

export async function getInspectionRoutes(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    status: req.query.status as any,
    departmentId: req.query.departmentId as string,
    assignedInspectorId: req.query.assignedInspectorId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await inspectionService.getInspectionRoutes(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function createInspectionTask(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const task = await inspectionService.createInspectionTask(req.body, userId);
  return successResponse(res, task, "巡检任务创建成功");
}

export async function getInspectionTask(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("任务ID不能为空", 400);
  }
  const task = await inspectionService.getInspectionTask(id);
  return successResponse(res, task, "查询成功");
}

export async function updateInspectionTask(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  if (!id) {
    throwApiError("任务ID不能为空", 400);
  }
  const task = await inspectionService.updateInspectionTask(id, req.body, userId);
  return successResponse(res, task, "巡检任务更新成功");
}

export async function deleteInspectionTask(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("任务ID不能为空", 400);
  }
  await inspectionService.deleteInspectionTask(id);
  return successResponse(res, null, "巡检任务删除成功");
}

export async function getInspectionTasks(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    routeId: req.query.routeId as string,
    status: req.query.status as any,
    inspectorId: req.query.inspectorId as string,
    pipelineId: req.query.pipelineId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await inspectionService.getInspectionTasks(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getInspectorTasks(req: Request, res: Response) {
  const { inspectorId } = req.params;
  if (!inspectorId) {
    throwApiError("巡检员ID不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    status: req.query.status as any,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await inspectionService.getInspectorTasks(inspectorId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function startInspectionTask(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  if (!id) {
    throwApiError("任务ID不能为空", 400);
  }
  const task = await inspectionService.startInspectionTask(id, userId);
  return successResponse(res, task, "巡检任务开始成功");
}

export async function completeInspectionTask(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  if (!id) {
    throwApiError("任务ID不能为空", 400);
  }
  const task = await inspectionService.completeInspectionTask(id, req.body, userId);
  return successResponse(res, task, "巡检任务完成成功");
}

export async function getInspectionStatistics(req: Request, res: Response) {
  const filters = {
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    departmentId: req.query.departmentId as string,
    inspectorId: req.query.inspectorId as string,
  };

  const statistics = await inspectionService.getInspectionStatistics(filters);
  return successResponse(res, statistics, "统计成功");
}
