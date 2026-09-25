import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb, now } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findCategory(householdId: string, id: string) {
  const db = await getDb();
  return db
    .prepare("SELECT name FROM categories WHERE id = ? AND household_id = ?")
    .bind(id, householdId)
    .first<{ name: string }>();
}

/**
 * Renombrar una categoría la renombra también en todos sus artículos, que
 * guardan el nombre y no el id.
 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;

  const current = await findCategory(me.householdId, id);
  if (!current) return fail("not_found", 404);

  const db = await getDb();
  const stmts = [];

  if ("name" in body) {
    const name = opt(body.name);
    if (!name) return fail("category_name_required");
    const clash = await db
      .prepare(
        "SELECT 1 FROM categories WHERE household_id = ? AND name = ? COLLATE NOCASE AND id <> ?",
      )
      .bind(me.householdId, name, id)
      .first();
    if (clash) return fail("category_exists");
    stmts.push(
      db
        .prepare("UPDATE categories SET name = ? WHERE id = ? AND household_id = ?")
        .bind(name, id, me.householdId),
      db
        .prepare(
          "UPDATE items SET category = ?, updated_at = ? WHERE household_id = ? AND category = ? COLLATE NOCASE",
        )
        .bind(name, now(), me.householdId, current.name),
    );
  }
  if ("sort_order" in body) {
    stmts.push(
      db
        .prepare("UPDATE categories SET sort_order = ? WHERE id = ? AND household_id = ?")
        .bind(Number(body.sort_order) || 0, id, me.householdId),
    );
  }
  if (!stmts.length) return fail("nothing_to_update");

  await db.batch(stmts);
  return json({ ok: true });
});

/** Borrar una categoría deja sus artículos sin categoría, como con las tiendas. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;

  const current = await findCategory(me.householdId, id);
  if (!current) return fail("not_found", 404);

  const db = await getDb();
  await db.batch([
    db
      .prepare("DELETE FROM categories WHERE id = ? AND household_id = ?")
      .bind(id, me.householdId),
    db
      .prepare(
        "UPDATE items SET category = NULL, updated_at = ? WHERE household_id = ? AND category = ? COLLATE NOCASE",
      )
      .bind(now(), me.householdId, current.name),
  ]);
  return json({ ok: true });
});
