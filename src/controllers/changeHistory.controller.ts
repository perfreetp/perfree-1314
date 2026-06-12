import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as changeHistoryService from "../services/changeHistory.service";

export async function getChangeHistory(req: Request, res: Response) {
  const { entityType, entityId } = req.params;
  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };

  const result = await changeHistoryService.getChangeHistory(entityType, entityId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function listChangeHistories(req: Request, res: Response) {
  const { entityType, operatorId } = req.query;

  let result;
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    changeType: req.query.changeType as any,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
  };

  if (entityType) {
    result = await changeHistoryService.getChangeHistoryByEntity(entityType as string, filters);
  } else if (operatorId) {
    result = await changeHistoryService.getChangeHistoryByOperator(operatorId as string, filters);
  } else {
    throwApiError("请提供 entityType 或 operatorId 参数", 400);
    return;
  }

  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getChangeStatistics(req: Request, res: Response) {
  const filters = {
    entityType: req.query.entityType as string,
    operatorId: req.query.operatorId as string,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    groupByDate: req.query.groupByDate as "day" | "week" | "month" | undefined,
  };

  const statistics = await changeHistoryService.getChangeStatistics(filters);
  return successResponse(res, statistics, "统计成功");
}

export async function recordChange(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const dto = {
    ...req.body,
    operatorId: req.body.operatorId || userId,
  };

  const history = await changeHistoryService.recordChange(dto);
  return successResponse(res, history, "记录成功");
}

export async function restoreVersion(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("历史记录ID不能为空", 400);
  }
  const userId = (req as any).user?.id;

  const restored = await changeHistoryService.restoreVersion(id, userId);
  return successResponse(res, restored, "恢复成功");
}

export async function compareEntities(req: Request, res: Response) {
  const { oldEntity, newEntity, excludeFields } = req.body;
  if (!oldEntity || !newEntity) {
    throwApiError("新旧实体不能为空", 400);
  }

  const diffs = changeHistoryService.compareEntities(oldEntity, newEntity, excludeFields);
  return successResponse(res, diffs, "比较成功");
}
