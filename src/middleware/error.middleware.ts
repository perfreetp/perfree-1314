import { Request, Response, NextFunction } from "express";
import { ApiError, errorResponse } from "../utils/response";
import { EntityNotFoundError } from "typeorm";

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[${new Date().toISOString()}] Error:`, error);

  if (error instanceof ApiError) {
    return errorResponse(res, error.message, error.code, error.data);
  }

  if (error instanceof EntityNotFoundError) {
    return errorResponse(res, "资源不存在", 404);
  }

  if (error.name === "QueryFailedError") {
    if (error.code === "23505") {
      return errorResponse(res, "数据已存在，违反唯一约束", 409);
    }
    if (error.code === "23503") {
      return errorResponse(res, "外键约束错误，关联数据不存在", 409);
    }
    return errorResponse(res, "数据库查询错误", 500, error.message);
  }

  if (error.name === "ValidationError") {
    return errorResponse(res, "数据验证失败", 400, error.errors);
  }

  if (error.name === "SyntaxError" && "body" in error) {
    return errorResponse(res, "请求体JSON格式错误", 400);
  }

  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
    return errorResponse(res, "服务连接错误", 503);
  }

  return errorResponse(
    res,
    process.env.NODE_ENV === "development" ? error.message : "服务器内部错误",
    500,
    process.env.NODE_ENV === "development" ? error.stack : undefined
  );
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  return errorResponse(res, `接口不存在: ${req.method} ${req.path}`, 404);
}
