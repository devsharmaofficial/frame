import bcrypt from "bcryptjs";
import { sha256 } from "./hash.js";

const BCRYPT_COST = 10;

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, storedHash: string): Promise<"bcrypt" | "legacy" | null> {
  if (isBcryptHash(storedHash)) {
    const ok = await bcrypt.compare(password, storedHash);
    return ok ? "bcrypt" : null;
  }
  // Legacy sha256 hex hash
  if (storedHash === sha256(password)) return "legacy";
  return null;
}
