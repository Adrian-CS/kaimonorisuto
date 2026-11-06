import { PHOTO_PREFIX, getDb, newId, now } from "./db";
import { sameName } from "./names";
import { nameKey } from "./money";
import type { Category, Item, Store } from "./types";

export async function listStores(householdId: string): Promise<Store[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      "SELECT id, name, color, sort_order FROM stores WHERE household_id = ? ORDER BY sort_order, name",
    )
    .bind(householdId)
    .all<Store>();
  return results ?? [];
}

export async function listCategories(householdId: string): Promise<Category[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      "SELECT id, name, sort_order FROM categories WHERE household_id = ? ORDER BY sort_order, name COLLATE NOCASE",
    )
    .bind(householdId)
    .all<Category>();
  return results ?? [];
}

/**
 * Devuelve la categoría con ese nombre (sin distinguir mayúsculas ni tildes
 * en mayúscula), creándola al final de la lista si aún no existe. Devuelve el
 * nombre tal y como está guardado, para que los artículos no acaben con
 * «leche» y «Leche». `wantedId` es el id que propone el cliente al crearla
 * sin conexión; un reintento con el mismo id devuelve la misma categoría.
 */
export async function ensureCategory(
  householdId: string,
  name: string,
  wantedId: string | null = null,
): Promise<{ id: string; name: string }> {
  const all = await listCategories(householdId);
  const dup = all.find((c) => c.id === wantedId || sameName(c.name, name));
  if (dup) return { id: dup.id, name: dup.name };

  const db = await getDb();
  const id = wantedId ?? newId();
  await db
    .prepare(
      "INSERT INTO categories (id, household_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, householdId, name, Math.max(0, ...all.map((c) => c.sort_order)) + 1, now())
    .run();
  return { id, name };
}

/**
 * El id de tienda solo vale si es de este hogar; si no (de otra casa, o una
 * tienda que se acaba de borrar), el artículo se queda sin tienda en vez de
 * fallar por la clave foránea y perder el resto del cambio.
 */
export async function ownStoreId(
  householdId: string,
  v: unknown,
): Promise<string | null> {
  if (typeof v !== "string" || !v) return null;
  const db = await getDb();
  const row = await db
    .prepare("SELECT id FROM stores WHERE id = ? AND household_id = ?")
    .bind(v, householdId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

/** Una clave de foto solo vale si es de las fotos de este hogar. */
export function ownPhotoKey(householdId: string, v: unknown): string | null {
  return typeof v === "string" && v.startsWith(`${PHOTO_PREFIX}/${householdId}/`)
    ? v
    : null;
}

export async function listItems(householdId: string): Promise<Item[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, name, qty, category, note, store_id, photo_key, price, done,
              sort_order, created_at, updated_at
       FROM items WHERE household_id = ?
       ORDER BY done, sort_order, name COLLATE NOCASE`,
    )
    .bind(householdId)
    .all<Item>();
  return results ?? [];
}

/** Guarda el último precio visto de un producto en una tienda. */
export async function rememberPrice(
  householdId: string,
  name: string,
  storeId: string | null,
  price: number,
) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO price_memory (household_id, name_key, store_id, price, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (household_id, name_key, store_id)
       DO UPDATE SET price = excluded.price, updated_at = excluded.updated_at`,
    )
    .bind(householdId, nameKey(name), storeId ?? "", price, now())
    .run();
}

/**
 * Precio recordado de un producto: primero el de esa tienda, y si no hay,
 * el más reciente en cualquier otra.
 */
export async function recallPrice(
  householdId: string,
  name: string,
  storeId: string | null,
): Promise<number | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT price FROM price_memory
       WHERE household_id = ? AND name_key = ?
       ORDER BY (store_id = ?) DESC, updated_at DESC
       LIMIT 1`,
    )
    .bind(householdId, nameKey(name), storeId ?? "")
    .first<{ price: number }>();
  return row?.price ?? null;
}
