import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { errorResponse, throwApiError } from "../utils/response";
import { UserRole } from "../types/enums";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User.entity";

export interface AuthRequest extends Request {
  user?: JwtPayload & {
    hasPermission?: (permission: string | string[]) => boolean;
    hasRole?: (role: UserRole | UserRole[]) => boolean;
  };
}

export function authMiddleware(required: boolean = true) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        if (required) {
          return errorResponse(res, "未提供认证令牌", 401);
        }
        return next();
      }

      const token = authHeader.split(" ")[1];

      let payload: JwtPayload;
      try {
        payload = verifyToken(token);
      } catch {
        return errorResponse(res, "认证令牌无效或已过期", 401);
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: payload.userId, isActive: true }
      });

      if (!user) {
        return errorResponse(res, "用户不存在或已被禁用", 401);
      }

      req.user = {
        ...payload,
        hasPermission(permission: string | string[]): boolean {
          if (!this.permissions) return false;
          const perms = Array.isArray(permission) ? permission : [permission];
          return perms.some(p => this.permissions!.includes(p) || this.permissions!.includes("*"));
        },
        hasRole(role: UserRole | UserRole[]): boolean {
          const roles = Array.isArray(role) ? role : [role];
          return roles.includes(this.role as UserRole) || this.role === UserRole.ADMIN;
        }
      };

      next();
    } catch (error) {
      errorResponse(res, "认证失败", 500, error);
    }
  };
}

export function requirePermission(permission: string | string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, "未认证", 401);
    }
    if (!req.user.hasPermission!(permission)) {
      return errorResponse(res, "权限不足", 403);
    }
    next();
  };
}

export function requireRole(role: UserRole | UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, "未认证", 401);
    }
    if (!req.user.hasRole!(role)) {
      return errorResponse(res, "角色权限不足", 403);
    }
    next();
  };
}
