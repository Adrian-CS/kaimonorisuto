import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function getDb() {
  return (await getEnv()).DB;
}

/**
 * Prefijo de todas las claves en R2. Así este proyecto puede compartir bucket
 * con otro sin pisarse (p. ej. el mismo bucket que ya usas en otro Worker).
 */
export const PHOTO_PREFIX = "lista-compra";

export function now() {
  return Date.now();
}

export function newId() {
  return crypto.randomUUID();
}

/** Código de invitación corto y legible (sin caracteres ambiguos). */
export function newCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
