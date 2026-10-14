import { PHOTO_PREFIX, getDb, getEnv } from "./db";

/** Fotos subidas hace menos de esto no se tocan: puede que aún se estén guardando. */
const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

function ownPrefix(householdId: string) {
  return `${PHOTO_PREFIX}/${householdId}/`;
}

/** Borra de R2 una foto del hogar si ya no la usa ningún artículo. */
export async function deletePhotoIfUnused(householdId: string, key: string | null) {
  if (!key || !key.startsWith(ownPrefix(householdId))) return;
  const db = await getDb();
  const used = await db
    .prepare("SELECT 1 FROM items WHERE photo_key = ? LIMIT 1")
    .bind(key)
    .first();
  if (used) return;
  const env = await getEnv();
  await env.PHOTOS.delete(key);
}

/**
 * Barre las fotos del hogar que no usa ningún artículo: las de artículos
 * cambiados o borrados antes de que esto existiera, y las que se subieron
 * desde una ficha que luego se cerró sin guardar.
 */
export async function sweepOrphanPhotos(householdId: string) {
  const db = await getDb();
  const env = await getEnv();
  const { results } = await db
    .prepare(
      "SELECT DISTINCT photo_key FROM items WHERE household_id = ? AND photo_key IS NOT NULL",
    )
    .bind(householdId)
    .all<{ photo_key: string }>();
  const used = new Set((results ?? []).map((r) => r.photo_key));
  const cutoff = Date.now() - SWEEP_GRACE_MS;

  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix: ownPrefix(householdId), cursor });
    const orphans = page.objects
      .filter((o) => !used.has(o.key) && o.uploaded.getTime() < cutoff)
      .map((o) => o.key);
    if (orphans.length) await env.PHOTOS.delete(orphans);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
