import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as conflictService from "../services/conflict.service";

export async function getConflictsByApplication(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const conflicts = await conflictService.getConflictsByApplication(id);
  return successResponse(res, conflicts, "查询成功");
}

export async function detectConflicts(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("申请ID不能为空", 400);
  }
  const { detectSpatial, detectVertical, detectSafetyDistance } = req.body;
  const result = await conflictService.detectConflicts({
    applicationId: id,
    detectSpatial: detectSpatial !== undefined ? detectSpatial : true,
    detectVertical: detectVertical !== undefined ? detectVertical : true,
    detectSafetyDistance: detectSafetyDistance !== undefined ? detectSafetyDistance : true,
  });
  return successResponse(res, result, "冲突检测完成");
}

export async function resolveConflict(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("冲突ID不能为空", 400);
  }
  const userId = (req as any).user?.id;
  const conflict = await conflictService.resolveConflict(id, req.body, userId);
  return successResponse(res, conflict, "冲突已标记为已解决");
}

export async function getConflictDetails(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("冲突ID不能为空", 400);
  }
  const conflict = await conflictService.getConflictDetails(id);
  return successResponse(res, conflict, "查询成功");
}

export async function getConflictStatistics(req: Request, res: Response) {
  const applicationId = req.query.applicationId as string | undefined;
  const statistics = await conflictService.getConflictStatistics(applicationId);
  return successResponse(res, statistics, "统计成功");
}
