import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User.entity";
import { UserRole } from "../types/enums";
import { throwApiError } from "../utils/response";
import { PaginationParams, paginateQuery } from "../utils/pagination";
import { hashPassword } from "../utils/jwt";
import { In } from "typeorm";

export interface CreateUserDto {
  username: string;
  password: string;
  realName: string;
  employeeId?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  departmentId?: string;
  permissions?: string[];
}

export interface UpdateUserDto extends Partial<Omit<CreateUserDto, "password" | "username">> {
  password?: string;
}

export interface UserListFilters extends PaginationParams {
  role?: UserRole;
  isActive?: boolean;
  departmentId?: string;
  keyword?: string;
}

export interface AssignRoleDto {
  role: UserRole;
}

const userRepository = AppDataSource.getRepository(User);

export async function createUser(dto: CreateUserDto, userId?: string): Promise<Omit<User, "passwordHash">> {
  const existingUser = await userRepository.findOne({
    where: [
      { username: dto.username },
      { employeeId: dto.employeeId },
    ],
  });

  if (existingUser) {
    if (existingUser.username === dto.username) {
      throwApiError("用户名已存在", 409);
    }
    if (existingUser.employeeId === dto.employeeId) {
      throwApiError("工号已存在", 409);
    }
  }

  const passwordHash = await hashPassword(dto.password);

  const user = userRepository.create({
    ...dto,
    passwordHash,
    role: dto.role || UserRole.VIEWER,
    isActive: true,
    createdBy: userId,
    updatedBy: userId,
  });

  const savedUser = await userRepository.save(user);
  const { passwordHash: _, ...userWithoutPassword } = savedUser;

  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function getUser(id: string): Promise<Omit<User, "passwordHash">> {
  const user = await userRepository.findOne({
    where: { id },
    relations: ["department"],
  });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function updateUser(
  id: string,
  dto: UpdateUserDto,
  userId?: string
): Promise<Omit<User, "passwordHash">> {
  const user = await userRepository.findOne({ where: { id } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  if (dto.employeeId && dto.employeeId !== user.employeeId) {
    const existingUser = await userRepository.findOne({
      where: { employeeId: dto.employeeId },
    });
    if (existingUser) {
      throwApiError("工号已存在", 409);
    }
  }

  let passwordHash = user.passwordHash;
  if (dto.password) {
    passwordHash = await hashPassword(dto.password);
  }

  const { password, ...updateData } = dto;

  const updated = userRepository.merge(user, {
    ...updateData,
    passwordHash,
    updatedBy: userId,
  });

  const savedUser = await userRepository.save(updated);
  const { passwordHash: _, ...userWithoutPassword } = savedUser;

  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function deleteUser(id: string): Promise<void> {
  const user = await userRepository.findOne({ where: { id } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  await userRepository.softDelete(id);
}

export async function listUsers(filters: UserListFilters) {
  const { page, pageSize, ...queryFilters } = filters;

  const qb = userRepository
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.department", "department")
    .where("user.deletedAt IS NULL");

  if (queryFilters.role) {
    qb.andWhere("user.role = :role", { role: queryFilters.role });
  }

  if (queryFilters.isActive !== undefined) {
    qb.andWhere("user.isActive = :isActive", { isActive: queryFilters.isActive });
  }

  if (queryFilters.departmentId) {
    qb.andWhere("user.departmentId = :departmentId", { departmentId: queryFilters.departmentId });
  }

  if (queryFilters.keyword) {
    qb.andWhere(
      "(user.username LIKE :keyword OR user.realName LIKE :keyword OR user.employeeId LIKE :keyword)",
      { keyword: `%${queryFilters.keyword}%` }
    );
  }

  qb.orderBy("user.createdAt", "DESC");

  const result = await paginateQuery(qb, { page, pageSize });

  const dataWithoutPassword = (result.data as any[]).map((user: User) => {
    const { passwordHash, ...rest } = user;
    return rest;
  });

  return {
    ...result,
    data: dataWithoutPassword,
  };
}

export async function getUsersByDepartment(departmentId: string) {
  const users = await userRepository.find({
    where: { departmentId, isActive: true },
    relations: ["department"],
    order: { createdAt: "DESC" },
  });

  return users.map((user) => {
    const { passwordHash, ...rest } = user;
    return rest;
  });
}

export async function getUsersByDepartmentIds(departmentIds: string[]) {
  const users = await userRepository.find({
    where: {
      departmentId: In(departmentIds),
      isActive: true,
    },
    relations: ["department"],
    order: { createdAt: "DESC" },
  });

  return users.map((user) => {
    const { passwordHash, ...rest } = user;
    return rest;
  });
}

export async function assignRole(
  id: string,
  role: UserRole,
  userId?: string
): Promise<Omit<User, "passwordHash">> {
  const user = await userRepository.findOne({ where: { id } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  user.role = role;
  user.updatedBy = userId as string;

  const savedUser = await userRepository.save(user);
  const { passwordHash, ...userWithoutPassword } = savedUser;

  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function toggleUserStatus(
  id: string,
  userId?: string
): Promise<Omit<User, "passwordHash">> {
  const user = await userRepository.findOne({ where: { id } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  user.isActive = !user.isActive;
  user.updatedBy = userId as string;

  const savedUser = await userRepository.save(user);
  const { passwordHash, ...userWithoutPassword } = savedUser;

  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function getUserPermissions(id: string): Promise<string[]> {
  const user = await userRepository.findOne({ where: { id } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const rolePermissions: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: ["*"],
    [UserRole.MANAGER]: [
      "user:view", "user:create", "user:update", "user:delete",
      "department:view", "department:create", "department:update", "department:delete",
      "pipeline:view", "pipeline:create", "pipeline:update", "pipeline:delete",
      "facility:view", "facility:create", "facility:update", "facility:delete",
      "sensor:view", "sensor:create", "sensor:update", "sensor:delete",
      "alert:view", "alert:update",
      "hazard:view", "hazard:create", "hazard:update", "hazard:delete",
      "risk:view", "risk:create", "risk:update", "risk:delete",
      "excavation:view", "excavation:create", "excavation:update", "excavation:delete",
      "emergency:view", "emergency:create", "emergency:update",
      "inspection:view", "inspection:create", "inspection:update",
      "workorder:view", "workorder:create", "workorder:update",
    ],
    [UserRole.ENGINEER]: [
      "user:view",
      "department:view",
      "pipeline:view", "pipeline:create", "pipeline:update",
      "facility:view", "facility:create", "facility:update",
      "sensor:view", "sensor:create", "sensor:update",
      "alert:view", "alert:update",
      "hazard:view", "hazard:create", "hazard:update",
      "risk:view", "risk:create", "risk:update",
      "excavation:view", "excavation:create", "excavation:update",
      "emergency:view",
      "inspection:view", "inspection:create", "inspection:update",
      "workorder:view", "workorder:create", "workorder:update",
    ],
    [UserRole.INSPECTOR]: [
      "user:view",
      "department:view",
      "pipeline:view",
      "facility:view",
      "sensor:view",
      "alert:view",
      "hazard:view", "hazard:create",
      "risk:view",
      "excavation:view",
      "emergency:view",
      "inspection:view", "inspection:create", "inspection:update",
      "workorder:view",
    ],
    [UserRole.MAINTENANCE]: [
      "user:view",
      "department:view",
      "pipeline:view",
      "facility:view",
      "sensor:view",
      "alert:view",
      "hazard:view",
      "risk:view",
      "excavation:view",
      "emergency:view",
      "inspection:view",
      "workorder:view", "workorder:update",
    ],
    [UserRole.VIEWER]: [
      "user:view",
      "department:view",
      "pipeline:view",
      "facility:view",
      "sensor:view",
      "alert:view",
      "hazard:view",
      "risk:view",
      "excavation:view",
      "emergency:view",
      "inspection:view",
      "workorder:view",
    ],
  };

  const basePermissions = rolePermissions[user.role] || rolePermissions[UserRole.VIEWER];
  const userPermissions = user.permissions || [];

  return [...new Set([...basePermissions, ...userPermissions])] as string[];
}
