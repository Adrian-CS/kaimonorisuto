import { getDb, now } from "./db";
import { nameKey } from "./money";
import type { Item, Store } from "./types";

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
