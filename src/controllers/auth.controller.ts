import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  login,
  register,
  logout,
  refreshToken,
  changePassword,
  getCurrentUser,
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
} from "../services/auth.service";

export async function loginHandler(req: Request, res: Response) {
  const dto = req.body as LoginDto;
  const result = await login(dto);
  return successResponse(res, result, "登录成功");
}

export async function registerHandler(req: Request, res: Response) {
  const dto = req.body as RegisterDto;
  const user = await register(dto);
  return successResponse(res, user, "注册成功");
}

export async function logoutHandler(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  await logout(userId!);
  return successResponse(res, null, "登出成功");
}

export async function refreshTokenHandler(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || "";
  const result = await refreshToken(token);
  return successResponse(res, result, "Token刷新成功");
}

export async function changePasswordHandler(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  const dto = req.body as ChangePasswordDto;
  await changePassword(userId!, dto);
  return successResponse(res, null, "密码修改成功");
}

export async function getCurrentUserHandler(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  const user = await getCurrentUser(userId!);
  return successResponse(res, user, "获取成功");
}
