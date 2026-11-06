import { PHOTO_PREFIX, getDb, newId, now } from "./db";
import { sameName } from "./names";
import { nameKey } from "./money";
import type { Category, Item, Product, Store } from "./types";

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

/** Lista de ids guardada como JSON en D1. */
export function parseIds(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]")) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Tiendas de un artículo a partir de lo que mande el cliente: `store_ids`
 * (lista) o, de clientes antiguos o colas guardadas de antes, `store_id`.
 * Devuelve `undefined` si el cuerpo no toca las tiendas. Solo se quedan las
 * que son de este hogar, sin repetir y en el orden recibido.
 */
export async function storeIdsFromBody(
  householdId: string,
  body: Record<string, unknown>,
): Promise<string[] | undefined> {
  let wanted: unknown[];
  if ("store_ids" in body) wanted = Array.isArray(body.store_ids) ? body.store_ids : [];
  else if ("store_id" in body) wanted = body.store_id ? [body.store_id] : [];
  else return undefined;

  const ids = [...new Set(wanted.filter((x): x is string => typeof x === "string" && !!x))];
  if (!ids.length) return [];
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT id FROM stores WHERE household_id = ?")
    .bind(householdId)
    .all<{ id: string }>();
  const own = new Set((results ?? []).map((r) => r.id));
  return ids.filter((id) => own.has(id));
}

/** Una clave de foto solo vale si es de las fotos de este hogar. */
export function ownPhotoKey(householdId: string, v: unknown): string | null {
  return typeof v === "string" && v.startsWith(`${PHOTO_PREFIX}/${householdId}/`)
    ? v
    : null;
}

/** Histórico de productos, lo más comprado primero. */
export async function listProducts(householdId: string): Promise<Product[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, name, qty, category, store_ids, photo_key, times, last_at
       FROM products WHERE household_id = ?
       ORDER BY times DESC, last_at DESC
       LIMIT 500`,
    )
    .bind(householdId)
    .all<Omit<Product, "store_ids"> & { store_ids: string }>();
  return (results ?? []).map((p) => ({ ...p, store_ids: parseIds(p.store_ids) }));
}

/** Marcar y desmarcar seguido no cuenta como varias compras. */
const SAME_PURCHASE_MS = 6 * 60 * 60 * 1000;

/**
 * Al marcar un artículo como comprado, se guarda (o actualiza) en el
 * histórico con sus datos actuales, para poder volver a añadirlo de un toque.
 */
export async function recordPurchase(householdId: string, itemId: string) {
  const db = await getDb();
  const item = await db
    .prepare(
      "SELECT name, qty, category, store_ids, photo_key FROM items WHERE id = ? AND household_id = ?",
    )
    .bind(itemId, householdId)
    .first<Pick<Item, "name" | "qty" | "category" | "photo_key"> & { store_ids: string }>();
  if (!item?.name.trim()) return;
  const t = now();
  await db
    .prepare(
      `INSERT INTO products (id, household_id, name_key, name, qty, category, store_ids, photo_key, times, last_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT (household_id, name_key) DO UPDATE SET
         name = excluded.name, qty = excluded.qty, category = excluded.category,
         store_ids = excluded.store_ids,
         -- Sin foto en el artículo, se conserva la que ya tenía el producto.
         photo_key = COALESCE(excluded.photo_key, products.photo_key),
         times = products.times + (CASE WHEN products.last_at < ? THEN 1 ELSE 0 END),
         last_at = excluded.last_at`,
    )
    .bind(
      newId(),
      householdId,
      nameKey(item.name),
      item.name.trim(),
      item.qty,
      item.category,
      item.store_ids,
      item.photo_key,
      t,
      t - SAME_PURCHASE_MS,
    )
    .run();
}

export async function listItems(householdId: string): Promise<Item[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT id, name, qty, category, note, store_ids, photo_key, price, done,
              sort_order, created_at, updated_at
       FROM items WHERE household_id = ?
       ORDER BY done, sort_order, name COLLATE NOCASE`,
    )
    .bind(householdId)
    .all<Omit<Item, "store_ids"> & { store_ids: string }>();
  return (results ?? []).map((i) => ({ ...i, store_ids: parseIds(i.store_ids) }));
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
