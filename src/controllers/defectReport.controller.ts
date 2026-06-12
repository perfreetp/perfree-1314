import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as defectReportService from "../services/defectReport.service";

export async function submitDefectReport(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) {
    throwApiError("用户未登录", 401);
  }

  const defect = await defectReportService.submitDefectReport(req.body, userId);
  return successResponse(res, defect, "缺陷报告提交成功");
}

export async function getDefectReport(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("缺陷ID不能为空", 400);
  }
  const defect = await defectReportService.getDefectReport(id);
  return successResponse(res, defect, "查询成功");
}

export async function updateDefectReport(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;
  if (!id) {
    throwApiError("缺陷ID不能为空", 400);
  }
  const defect = await defectReportService.updateDefectReport(id, req.body, userId);
  return successResponse(res, defect, "缺陷报告更新成功");
}

export async function deleteDefectReport(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("缺陷ID不能为空", 400);
  }
  await defectReportService.deleteDefectReport(id);
  return successResponse(res, null, "缺陷报告删除成功");
}

export async function getDefectReports(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    severity: req.query.severity as any,
    isRepaired: req.query.isRepaired ? req.query.isRepaired === "true" : undefined,
    pipelineId: req.query.pipelineId as string,
    facilityId: req.query.facilityId as string,
    reporterId: req.query.reporterId as string,
    inspectorId: req.query.inspectorId as string,
    workOrderId: req.query.workOrderId as string,
    inspectionTaskId: req.query.inspectionTaskId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await defectReportService.getDefectReports(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getDefectsByPipeline(req: Request, res: Response) {
  const { pipelineId } = req.params;
  if (!pipelineId) {
    throwApiError("管线ID不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    severity: req.query.severity as any,
    isRepaired: req.query.isRepaired ? req.query.isRepaired === "true" : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await defectReportService.getDefectsByPipeline(pipelineId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getDefectsByInspector(req: Request, res: Response) {
  const { inspectorId } = req.params;
  if (!inspectorId) {
    throwApiError("巡检员ID不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    type: req.query.type as any,
    severity: req.query.severity as any,
    isRepaired: req.query.isRepaired ? req.query.isRepaired === "true" : undefined,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  const result = await defectReportService.getDefectsByInspector(inspectorId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function linkDefectToWorkOrder(req: Request, res: Response) {
  const { id } = req.params;
  const { workOrderId } = req.body;
  const userId = (req as any).user?.id;

  if (!id || !workOrderId) {
    throwApiError("缺陷ID和工单ID不能为空", 400);
  }

  const defect = await defectReportService.linkDefectToWorkOrder(id, workOrderId, userId);
  return successResponse(res, defect, "关联工单成功");
}

export async function updateDefectRepairStatus(req: Request, res: Response) {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  if (!id) {
    throwApiError("缺陷ID不能为空", 400);
  }

  const defect = await defectReportService.updateDefectRepairStatus(id, req.body, userId);
  return successResponse(res, defect, "修复状态更新成功");
}

export async function getDefectStatistics(req: Request, res: Response) {
  const filters = {
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    pipelineId: req.query.pipelineId as string,
    departmentId: req.query.departmentId as string,
  };

  const statistics = await defectReportService.getDefectStatistics(filters);
  return successResponse(res, statistics, "统计成功");
}
