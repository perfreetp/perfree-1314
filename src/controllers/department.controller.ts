import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  createDepartment,
  getDepartment,
  updateDepartment,
  deleteDepartment,
  listDepartments,
  getDepartmentTree,
  getUsersByDepartmentTree,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from "../services/department.service";

export async function createDepartmentHandler(req: AuthRequest, res: Response) {
  const dto = req.body as CreateDepartmentDto;
  const userId = req.user?.userId;
  const department = await createDepartment(dto, userId);
  return successResponse(res, department, "部门创建成功");
}

export async function getDepartmentHandler(req: Request, res: Response) {
  const { id } = req.params;
  const department = await getDepartment(id);
  return successResponse(res, department);
}

export async function updateDepartmentHandler(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const dto = req.body as UpdateDepartmentDto;
  const userId = req.user?.userId;
  const department = await updateDepartment(id, dto, userId);
  return successResponse(res, department, "部门更新成功");
}

export async function deleteDepartmentHandler(req: Request, res: Response) {
  const { id } = req.params;
  await deleteDepartment(id);
  return successResponse(res, null, "部门删除成功");
}

export async function listDepartmentsHandler(req: Request, res: Response) {
  const filters = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: parseInt(req.query.pageSize as string) || 20,
    parentId: req.query.parentId as string,
    keyword: req.query.keyword as string,
  };
  const result = await listDepartments(filters);
  return successResponse(res, result.data, "查询成功", {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function getDepartmentTreeHandler(req: Request, res: Response) {
  const { id } = req.params;
  const tree = await getDepartmentTree(id);
  return successResponse(res, tree, "查询成功");
}

export async function getUsersByDepartmentTreeHandler(req: Request, res: Response) {
  const { id } = req.params;
  const users = await getUsersByDepartmentTree(id);
  return successResponse(res, users, "查询成功");
}
