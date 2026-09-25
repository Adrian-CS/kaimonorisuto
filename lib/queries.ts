import { getDb, newId, now } from "./db";
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
 * Devuelve la categoría con ese nombre (sin distinguir mayúsculas), creándola
 * al final de la lista si aún no existe. Devuelve el nombre tal y como está
 * guardado, para que los artículos no acaben con «leche» y «Leche».
 */
export async function ensureCategory(
  householdId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const db = await getDb();
  const dup = await db
    .prepare(
      "SELECT id, name FROM categories WHERE household_id = ? AND name = ? COLLATE NOCASE",
    )
    .bind(householdId, name)
    .first<{ id: string; name: string }>();
  if (dup) return dup;

  const max = await db
    .prepare("SELECT MAX(sort_order) AS m FROM categories WHERE household_id = ?")
    .bind(householdId)
    .first<{ m: number | null }>();
  const id = newId();
  await db
    .prepare(
      "INSERT INTO categories (id, household_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, householdId, name, (max?.m ?? 0) + 1, now())
    .run();
  return { id, name };
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
