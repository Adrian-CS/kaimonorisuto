import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { PHOTO_PREFIX, getDb, getEnv, now } from "@/lib/db";
import { ensureCategory, rememberPrice } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const OPTIONAL_FIELDS = ["qty", "note", "store_id", "photo_key"] as const;

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;

  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if ("name" in body) {
    const name = opt(body.name);
    if (!name) return fail("item_name_required");
    sets.push("name = ?");
    values.push(name);
  }
  for (const f of OPTIONAL_FIELDS) {
    if (f in body) {
      sets.push(`${f} = ?`);
      values.push(opt(body[f]));
    }
  }
  if ("category" in body) {
    // Una categoría nueva escrita aquí también entra en la lista del hogar.
    const c = opt(body.category);
    sets.push("category = ?");
    values.push(c ? (await ensureCategory(me.householdId, c)).name : null);
  }
  if ("price" in body) {
    const p = body.price;
    sets.push("price = ?");
    values.push(typeof p === "number" && p >= 0 ? Math.round(p) : null);
  }
  if ("done" in body) {
    sets.push("done = ?");
    values.push(body.done ? 1 : 0);
  }
  if ("sort_order" in body) {
    sets.push("sort_order = ?");
    values.push(Number(body.sort_order) || 0);
  }
  if (!sets.length) return fail("nothing_to_update");

  sets.push("updated_at = ?");
  values.push(now());

  const db = await getDb();
  const res = await db
    .prepare(
      `UPDATE items SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`,
    )
    .bind(...values, id, me.householdId)
    .run();

  if (!res.meta.changes) return fail("not_found", 404);

  // Recuerda el precio para la próxima vez que se añada este producto.
  if (typeof body.price === "number" && body.price > 0) {
    const row = await db
      .prepare("SELECT name, store_id FROM items WHERE id = ?")
      .bind(id)
      .first<{ name: string; store_id: string | null }>();
    if (row)
      await rememberPrice(
        me.householdId,
        row.name,
        row.store_id,
        Math.round(body.price),
      );
  }

  return json({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const db = await getDb();

  const row = await db
    .prepare("SELECT photo_key FROM items WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .first<{ photo_key: string | null }>();
  if (!row) return fail("not_found", 404);

  await db
    .prepare("DELETE FROM items WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .run();

  // Limpia la foto de R2 si ya no la usa ningún otro artículo.
  if (row.photo_key) {
    const stillUsed = await db
      .prepare("SELECT 1 FROM items WHERE photo_key = ? LIMIT 1")
      .bind(row.photo_key)
      .first();
    if (!stillUsed) {
      const env = await getEnv();
      if (row.photo_key.startsWith(`${PHOTO_PREFIX}/${me.householdId}/`))
        await env.PHOTOS.delete(row.photo_key);
    }
  }

  return json({ ok: true });
});
