import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User.entity";
import { UserRole } from "../types/enums";
import { throwApiError } from "../utils/response";
import { generateToken, verifyToken, hashPassword, comparePassword, JwtPayload } from "../utils/jwt";

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  realName: string;
  employeeId?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  departmentId?: string;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordDto {
  username: string;
  newPassword: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface LoginResponse {
  user: Omit<User, "passwordHash">;
  token: string;
  tokenType: string;
  expiresIn: string;
}

const userRepository = AppDataSource.getRepository(User);

export function generateUserToken(user: User): JwtPayload {
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    departmentId: user.departmentId,
    permissions: user.permissions || [],
  };
}

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const user = await userRepository.findOne({
    where: { username: dto.username },
    relations: ["department"],
  });

  if (!user) {
    throwApiError("用户名或密码错误", 401);
  }

  if (!user.isActive) {
    throwApiError("用户已被禁用，请联系管理员", 401);
  }

  const isPasswordValid = await comparePassword(dto.password, user.passwordHash);
  if (!isPasswordValid) {
    throwApiError("用户名或密码错误", 401);
  }

  user.lastLoginAt = new Date();
  await userRepository.save(user);

  const payload = generateUserToken(user);
  const token = generateToken(payload);

  const { passwordHash, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword as Omit<User, "passwordHash">,
    token,
    tokenType: "Bearer",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  };
}

export async function register(dto: RegisterDto): Promise<Omit<User, "passwordHash">> {
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
  });

  const savedUser = await userRepository.save(user);
  const { passwordHash: _, ...userWithoutPassword } = savedUser;

  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function logout(userId: string): Promise<void> {
  const user = await userRepository.findOne({ where: { id: userId } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  user.lastLogoutAt = new Date();
  await userRepository.save(user);
}

export async function refreshToken(token: string): Promise<{ token: string; tokenType: string; expiresIn: string }> {
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throwApiError("Token无效或已过期", 401);
  }

  const user = await userRepository.findOne({
    where: { id: payload.userId, isActive: true },
  });

  if (!user) {
    throwApiError("用户不存在或已被禁用", 401);
  }

  const newPayload = generateUserToken(user);
  const newToken = generateToken(newPayload);

  return {
    token: newToken,
    tokenType: "Bearer",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  };
}

export async function changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await userRepository.findOne({ where: { id: userId } });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const isOldPasswordValid = await comparePassword(dto.oldPassword, user.passwordHash);
  if (!isOldPasswordValid) {
    throwApiError("原密码错误", 400);
  }

  if (dto.oldPassword === dto.newPassword) {
    throwApiError("新密码不能与原密码相同", 400);
  }

  user.passwordHash = await hashPassword(dto.newPassword);
  await userRepository.save(user);
}

export async function resetPassword(dto: ResetPasswordDto): Promise<void> {
  const user = await userRepository.findOne({
    where: { username: dto.username },
  });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  user.passwordHash = await hashPassword(dto.newPassword);
  await userRepository.save(user);
}

export async function getCurrentUser(userId: string): Promise<Omit<User, "passwordHash">> {
  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ["department"],
  });

  if (!user) {
    throwApiError("用户不存在", 404);
  }

  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword as Omit<User, "passwordHash">;
}

export async function validateToken(token: string): Promise<JwtPayload & { user: Omit<User, "passwordHash"> }> {
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throwApiError("Token无效或已过期", 401);
  }

  const user = await userRepository.findOne({
    where: { id: payload.userId, isActive: true },
    relations: ["department"],
  });

  if (!user) {
    throwApiError("用户不存在或已被禁用", 401);
  }

  const { passwordHash, ...userWithoutPassword } = user;

  return {
    ...payload,
    user: userWithoutPassword as Omit<User, "passwordHash">,
  };
}
