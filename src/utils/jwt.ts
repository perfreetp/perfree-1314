import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const jwtAny = jwt as any;
const bcryptAny = bcrypt as any;

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  departmentId?: string;
  permissions?: string[];
}

export function generateToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET || "your-secret-key";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwtAny.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET || "your-secret-key";
  return jwtAny.verify(token, secret) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptAny.genSalt(10);
  return bcryptAny.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptAny.compare(password, hash);
}
