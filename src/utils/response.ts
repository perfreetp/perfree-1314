import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  timestamp: number;
  total?: number;
  page?: number;
  pageSize?: number;
}

export function successResponse<T = any>(
  res: Response,
  data?: T,
  message: string = "操作成功",
  options?: { total?: number; page?: number; pageSize?: number }
): Response<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    code: 200,
    message,
    data,
    timestamp: Date.now(),
  };

  if (options) {
    if (options.total !== undefined) response.total = options.total;
    if (options.page !== undefined) response.page = options.page;
    if (options.pageSize !== undefined) response.pageSize = options.pageSize;
  }

  return res.status(200).json(response);
}

export function errorResponse(
  res: Response,
  message: string = "操作失败",
  code: number = 500,
  error?: any
): Response<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    code,
    message,
    timestamp: Date.now(),
    data: process.env.NODE_ENV === "development" ? error : undefined,
  };

  return res.status(code).json(response);
}

export class ApiError extends Error {
  code: number;
  data?: any;

  constructor(message: string, code: number = 500, data?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.data = data;
  }
}

export function throwApiError(message: string, code: number = 500, data?: any): never {
  throw new ApiError(message, code, data);
}
