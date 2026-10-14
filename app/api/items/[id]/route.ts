import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb, now } from "@/lib/db";
import { deletePhotoIfUnused } from "@/lib/photos";
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

  // Si cambia la foto, la anterior se borra cuando nadie más la use.
  const before =
    "photo_key" in body
      ? await db
          .prepare("SELECT photo_key FROM items WHERE id = ? AND household_id = ?")
          .bind(id, me.householdId)
          .first<{ photo_key: string | null }>()
      : null;

  const res = await db
    .prepare(
      `UPDATE items SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`,
    )
    .bind(...values, id, me.householdId)
    .run();

  if (!res.meta.changes) return fail("not_found", 404);

  if (before?.photo_key && before.photo_key !== opt(body.photo_key))
    await deletePhotoIfUnused(me.householdId, before.photo_key);

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
  await deletePhotoIfUnused(me.householdId, row.photo_key);

  return json({ ok: true });
});
