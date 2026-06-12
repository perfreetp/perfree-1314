import { Request, Response } from "express";
import { successResponse, throwApiError } from "../utils/response";
import * as sharingScopeService from "../services/sharingScope.service";

export async function createSharingScope(req: Request, res: Response) {
  const scope = await sharingScopeService.createSharingScope(req.body);
  return successResponse(res, scope, "创建成功");
}

export async function getSharingScope(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("共享范围ID不能为空", 400);
  }
  const scope = await sharingScopeService.getSharingScope(id);
  return successResponse(res, scope, "查询成功");
}

export async function updateSharingScope(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("共享范围ID不能为空", 400);
  }
  const scope = await sharingScopeService.updateSharingScope(id, req.body);
  return successResponse(res, scope, "更新成功");
}

export async function deleteSharingScope(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("共享范围ID不能为空", 400);
  }
  await sharingScopeService.deleteSharingScope(id);
  return successResponse(res, null, "删除成功");
}

export async function listSharingScopes(req: Request, res: Response) {
  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    entityType: req.query.entityType as string,
    entityId: req.query.entityId as string,
    sharingLevel: req.query.sharingLevel as any,
    targetType: req.query.targetType as string,
    targetId: req.query.targetId as string,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
  };

  const result = await sharingScopeService.listSharingScopes(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function shareToDepartment(req: Request, res: Response) {
  const { entityType, entityId, departmentId, permissions, allowedFields, deniedFields, validFrom, validTo } = req.body;
  if (!entityType || !entityId || !departmentId) {
    throwApiError("实体类型、实体ID和部门ID不能为空", 400);
  }

  const scope = await sharingScopeService.shareToDepartment({
    entityType,
    entityId,
    departmentId,
    permissions,
    allowedFields,
    deniedFields,
    validFrom: validFrom ? new Date(validFrom) : undefined,
    validTo: validTo ? new Date(validTo) : undefined,
  });
  return successResponse(res, scope, "共享成功");
}

export async function shareToUser(req: Request, res: Response) {
  const { entityType, entityId, userId, permissions, allowedFields, deniedFields, validFrom, validTo } = req.body;
  if (!entityType || !entityId || !userId) {
    throwApiError("实体类型、实体ID和用户ID不能为空", 400);
  }

  const scope = await sharingScopeService.shareToUser({
    entityType,
    entityId,
    userId,
    permissions,
    allowedFields,
    deniedFields,
    validFrom: validFrom ? new Date(validFrom) : undefined,
    validTo: validTo ? new Date(validTo) : undefined,
  });
  return successResponse(res, scope, "共享成功");
}

export async function revokeSharing(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("共享范围ID不能为空", 400);
  }
  const scope = await sharingScopeService.revokeSharing(id);
  return successResponse(res, scope, "撤销成功");
}

export async function checkPermission(req: Request, res: Response) {
  const { userId, entityType, entityId, permission } = req.body;
  const currentUserId = (req as any).user?.id;

  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  const result = await sharingScopeService.checkPermission({
    userId: userId || currentUserId,
    entityType,
    entityId,
    permission: permission as "view" | "edit" | "delete" | "export",
  });
  return successResponse(res, result, "检查完成");
}

export async function getAccessibleEntities(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const { entityType } = req.params;
  if (!userId) {
    throwApiError("用户未登录", 401);
  }
  if (!entityType) {
    throwApiError("实体类型不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };

  const result = await sharingScopeService.getAccessibleEntities({
    userId,
    entityType,
    permission: req.query.permission as "view" | "edit" | "delete" | "export",
    filters,
  });

  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getEntitySharings(req: Request, res: Response) {
  const { entityType, entityId } = req.params;
  if (!entityType || !entityId) {
    throwApiError("实体类型和实体ID不能为空", 400);
  }

  const filters = {
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
  };

  const result = await sharingScopeService.getEntitySharings(entityType, entityId, filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function updateSharingPermissions(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    throwApiError("共享范围ID不能为空", 400);
  }

  const scope = await sharingScopeService.updateSharingPermissions({
    id,
    ...req.body,
  });
  return successResponse(res, scope, "权限更新成功");
}

export async function getSharingStatistics(req: Request, res: Response) {
  const statistics = await sharingScopeService.getSharingStatistics();
  return successResponse(res, statistics, "统计成功");
}
