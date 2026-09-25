import { cookies } from "next/headers";
import { getDb, newId, now } from "./db";
import type { Me } from "./types";
import { DEFAULT_CURRENCY, isCurrency } from "./money";

const COOKIE = "sesion";
const SESSION_MS = 1000 * 60 * 60 * 24 * 365; // 1 año
const ITERATIONS = 100_000;

/* ---------- contraseñas (PBKDF2-SHA256, WebCrypto) ---------- */

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pbkdf2(password: string, saltHex: string) {
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string) {
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2(password, saltHex);
  return `pbkdf2$${ITERATIONS}$${saltHex}$${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, , saltHex, expected] = stored.split("$");
  if (!saltHex || !expected) return false;
  const actual = await pbkdf2(password, saltHex);
  // comparación en tiempo constante
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++)
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/* ---------- sesiones ---------- */

export async function createSession(userId: string) {
  const db = await getDb();
  const id = newId();
  const t = now();
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id, userId, t + SESSION_MS, t)
    .run();

  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }
  jar.delete(COOKIE);
}

/** Devuelve el usuario de la sesión actual, o null. */
export async function getMe(): Promise<Me | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;

  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT s.expires_at, u.id AS user_id, u.name AS user_name,
              h.id AS household_id, h.name AS household_name, h.invite_code,
              h.currency
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN households h ON h.id = u.household_id
       WHERE s.id = ?`,
    )
    .bind(id)
    .first<{
      expires_at: number;
      user_id: string;
      user_name: string;
      household_id: string;
      household_name: string;
      invite_code: string;
      currency: string;
    }>();

  if (!row) return null;
  if (row.expires_at < now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }

  return {
    userId: row.user_id,
    userName: row.user_name,
    householdId: row.household_id,
    householdName: row.household_name,
    inviteCode: row.invite_code,
    currency: isCurrency(row.currency) ? row.currency : DEFAULT_CURRENCY,
  };
}

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new UnauthorizedError();
  return me;
}

export class UnauthorizedError extends Error {}
