import { getDb, now } from "./db";

/**
 * Límite de intentos fallidos para login y códigos de invitación.
 *
 * No es un rate limit general (para dos personas no hace falta): solo cuenta
 * fallos, así que quien entra bien nunca lo nota. Con una contraseña de 8
 * caracteres y 10 intentos cada 15 minutos, probar a lo bruto deja de ser
 * viable.
 */
const WINDOW_MS = 15 * 60 * 1000;

export const LIMITS = {
  email: 10, // por cuenta: protege una cuenta concreta
  ip: 30, // por IP: frena a quien va probando muchas cuentas
  code: 20, // códigos de invitación inválidos por IP
} as const;

export function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/** true si alguna de las claves ha superado su límite en la ventana. */
export async function isBlocked(keys: [kind: keyof typeof LIMITS, value: string][]) {
  const db = await getDb();
  const since = now() - WINDOW_MS;
  // Limpieza de paso: lo de hace más de una hora ya no cuenta para nada.
  await db
    .prepare("DELETE FROM auth_failures WHERE at < ?")
    .bind(now() - 4 * WINDOW_MS)
    .run();
  for (const [kind, value] of keys) {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM auth_failures WHERE key = ? AND at >= ?")
      .bind(`${kind}:${value}`, since)
      .first<{ n: number }>();
    if ((row?.n ?? 0) >= LIMITS[kind]) return true;
  }
  return false;
}

export async function recordFailure(keys: [kind: keyof typeof LIMITS, value: string][]) {
  const db = await getDb();
  const t = now();
  await db.batch(
    keys.map(([kind, value]) =>
      db
        .prepare("INSERT INTO auth_failures (key, at) VALUES (?, ?)")
        .bind(`${kind}:${value}`, t),
    ),
  );
}

/** Al entrar bien, los fallos de esa cuenta dejan de contar. */
export async function clearFailures(kind: keyof typeof LIMITS, value: string) {
  const db = await getDb();
  await db
    .prepare("DELETE FROM auth_failures WHERE key = ?")
    .bind(`${kind}:${value}`)
    .run();
}
