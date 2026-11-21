import { Buffer } from "node:buffer";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function normalizeEmail(email) {
  if (typeof email !== "string") return null;

  const normalized = email.trim().toLowerCase();
  return normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}

export function isValidPassword(password) {
  return typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;

  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex || !/^[\da-f]+$/i.test(saltHex) || !/^[\da-f]+$/i.test(hashHex)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== 64) return false;

  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeUserData(value) {
  if (!isRecord(value)) return null;

  const shelves = value.shelves ?? null;
  const stackTops = value.stackTops ?? {};
  const shelfCount = value.shelfCount ?? 5;
  const theme = value.theme ?? null;
  const goodreadsBooks = value.goodreadsBooks ?? [];

  if (shelves !== null && !Array.isArray(shelves) && !isRecord(shelves)) return null;
  if (!isRecord(stackTops)) return null;
  if (!Number.isInteger(shelfCount) || shelfCount < 1 || shelfCount > 50) return null;
  if (theme !== null && !isRecord(theme)) return null;
  if (!Array.isArray(goodreadsBooks) || goodreadsBooks.length > 10000) return null;

  return { shelves, stackTops, shelfCount, theme, goodreadsBooks };
}
