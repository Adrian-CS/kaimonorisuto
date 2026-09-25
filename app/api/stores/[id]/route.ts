import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;

  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if ("name" in body) {
    const name = opt(body.name);
    if (!name) return fail("store_name_required");
    sets.push("name = ?");
    values.push(name);
  }
  if ("color" in body) {
    sets.push("color = ?");
    values.push(opt(body.color));
  }
  if ("sort_order" in body) {
    sets.push("sort_order = ?");
    values.push(Number(body.sort_order) || 0);
  }
  if (!sets.length) return fail("nothing_to_update");

  const db = await getDb();
  const res = await db
    .prepare(
      `UPDATE stores SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`,
    )
    .bind(...values, id, me.householdId)
    .run();

  if (!res.meta.changes) return fail("not_found", 404);
  return json({ ok: true });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const db = await getDb();
  const res = await db
    .prepare("DELETE FROM stores WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .run();
  if (!res.meta.changes) return fail("not_found", 404);
  return json({ ok: true });
});
