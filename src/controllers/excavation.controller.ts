import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as excavationService from "../services/excavation.service";
import { ApplicationStatus } from "../types/enums";

export async function createExcavation(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const application = await excavationService.createExcavation(req.body, userId);
  return successResponse(res, application, "开挖申请创建成功");
}

export async function getExcavation(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const application = await excavationService.getExcavation(id);
  return successResponse(res, application, "查询成功");
}

export async function updateExcavation(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const application = await excavationService.updateExcavation(id, req.body, userId);
  return successResponse(res, application, "开挖申请更新成功");
}

export async function deleteExcavation(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  await excavationService.deleteExcavation(id);
  return successResponse(res, null, "开挖申请删除成功");
}

export async function listExcavations(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    status: req.query.status as ApplicationStatus,
    applicantDepartmentId: req.query.applicantDepartmentId as string,
    projectName: req.query.projectName as string,
    applicationNo: req.query.applicationNo as string,
    hasConflict: req.query.hasConflict ? req.query.hasConflict === "true" : undefined,
  };

  const result = await excavationService.listExcavations(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function submitApplication(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const application = await excavationService.submitApplication(id, userId);
  return successResponse(res, application, "申请提交成功");
}

export async function reviewApplication(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const application = await excavationService.reviewApplication(id, req.body, userId);
  return successResponse(res, application, "审核完成");
}

export async function verifyExcavationSafety(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const result = await excavationService.verifyExcavationSafety(id);
  return successResponse(res, result, "安全校核完成");
}

export async function completeApplication(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const application = await excavationService.completeApplication(id, userId);
  return successResponse(res, application, "申请已完成归档");
}

export async function getApplicationStatistics(req: Request, res: Response) {
  const statistics = await excavationService.getApplicationStatistics();
  return successResponse(res, statistics, "统计成功");
}

export async function getApplicationsByStatus(req: Request, res: Response) {
  const { status } = req.params;
  if (!status) {
    throwApiError("状态不能为空", 400);
  }
  const pagination = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };
  const result = await excavationService.getApplicationsByStatus(
    status as ApplicationStatus,
    pagination
  );
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getApplicationsByDepartment(req: Request, res: Response) {
  const { departmentId } = req.params;
  if (!departmentId) {
    throwApiError("部门ID不能为空", 400);
  }
  const pagination = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };
  const result = await excavationService.getApplicationsByDepartment(departmentId, pagination);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}
