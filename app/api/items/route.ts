import { requireMe } from "@/lib/auth";
import { clientId, fail, handler, json, opt } from "@/lib/api";
import { getDb, newId, now } from "@/lib/db";
import { ensureCategory, recallPrice } from "@/lib/queries";
import { notifyHousehold } from "@/lib/notify";
import { sweepOrphanPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as Record<string, unknown>;

  const name = opt(body.name);
  if (!name) return fail("item_name_required");

  const db = await getDb();
  const t = now();
  // El cliente manda su propio id para poder crear artículos sin conexión.
  // Si ya existe es un reintento de algo que sí llegó: no se duplica.
  const id = clientId(body.id) ?? newId();
  const existing = await db
    .prepare("SELECT price FROM items WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .first<{ price: number | null }>();
  if (existing) return json({ id, price: existing.price });
  const storeId = opt(body.store_id);
  const rawCategory = opt(body.category);
  const category = rawCategory
    ? (await ensureCategory(me.householdId, rawCategory)).name
    : null;

  // Nuevos artículos arriba del todo.
  const min = await db
    .prepare("SELECT MIN(sort_order) AS m FROM items WHERE household_id = ?")
    .bind(me.householdId)
    .first<{ m: number | null }>();
  const sortOrder = (min?.m ?? 0) - 1;

  // Si ya compramos esto antes, arrastramos el último precio conocido.
  const price =
    typeof body.price === "number"
      ? body.price
      : await recallPrice(me.householdId, name, storeId);

  await db
    .prepare(
      `INSERT INTO items
        (id, household_id, name, qty, category, note, store_id, photo_key, price, done, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(
      id,
      me.householdId,
      name,
      opt(body.qty),
      category,
      opt(body.note),
      storeId,
      opt(body.photo_key),
      price,
      sortOrder,
      t,
      t,
    )
    .run();

  // Solo avisa si quien añade lo ha pedido expresamente.
  if (body.notify === true) {
    await notifyHousehold(me.householdId, me.userId, {
      itemId: id,
      itemName: name,
      byName: me.userName,
      kind: "added",
    });
  }

  return json({ id, price });
});

/**
 * Borra en bloque todos los artículos ya comprados, y de paso barre las fotos
 * que se hayan quedado sin artículo.
 */
export const DELETE = handler(async () => {
  const me = await requireMe();
  const db = await getDb();
  await db
    .prepare("DELETE FROM items WHERE household_id = ? AND done = 1")
    .bind(me.householdId)
    .run();
  await sweepOrphanPhotos(me.householdId);
  return json({ ok: true });
});
