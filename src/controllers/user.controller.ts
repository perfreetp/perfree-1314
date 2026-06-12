import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  listUsers,
  getUsersByDepartment,
  assignRole,
  toggleUserStatus,
  getUserPermissions,
  CreateUserDto,
  UpdateUserDto,
  AssignRoleDto,
} from "../services/user.service";

export async function createUserHandler(req: AuthRequest, res: Response) {
  const dto = req.body as CreateUserDto;
  const userId = req.user?.userId;
  const user = await createUser(dto, userId);
  return successResponse(res, user, "用户创建成功");
}

export async function getUserHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = await getUser(id);
  return successResponse(res, user);
}

export async function updateUserHandler(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const dto = req.body as UpdateUserDto;
  const userId = req.user?.userId;
  const user = await updateUser(id, dto, userId);
  return successResponse(res, user, "用户更新成功");
}

export async function deleteUserHandler(req: Request, res: Response) {
  const { id } = req.params;
  await deleteUser(id);
  return successResponse(res, null, "用户删除成功");
}

export async function listUsersHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    role: req.query.role as any,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    departmentId: req.query.departmentId as string,
    keyword: req.query.keyword as string,
  };
  const result = await listUsers(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getUsersByDepartmentHandler(req: Request, res: Response) {
  const { departmentId } = req.params;
  const users = await getUsersByDepartment(departmentId);
  return successResponse(res, users, "查询成功");
}

export async function assignRoleHandler(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const dto = req.body as AssignRoleDto;
  const userId = req.user?.userId;
  const user = await assignRole(id, dto.role, userId);
  return successResponse(res, user, "角色分配成功");
}

export async function toggleUserStatusHandler(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.userId;
  const user = await toggleUserStatus(id, userId);
  return successResponse(res, user, user.isActive ? "用户已启用" : "用户已禁用");
}

export async function getUserPermissionsHandler(req: Request, res: Response) {
  const { id } = req.params;
  const permissions = await getUserPermissions(id);
  return successResponse(res, permissions, "获取成功");
}
