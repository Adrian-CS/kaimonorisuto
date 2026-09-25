import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb, now } from "@/lib/db";
import { ensureCategory } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Cambia la categoría y/o el supermercado de varios artículos a la vez.
 * Solo se tocan los campos que vienen en el cuerpo; `null` los vacía.
 */
export const PATCH = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as Record<string, unknown>;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (!ids.length || ids.length > 500) return fail("nothing_to_update");

  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if ("category" in body) {
    const c = opt(body.category);
    sets.push("category = ?");
    values.push(c ? (await ensureCategory(me.householdId, c)).name : null);
  }
  if ("store_id" in body) {
    sets.push("store_id = ?");
    values.push(opt(body.store_id));
  }
  if (!sets.length) return fail("nothing_to_update");

  sets.push("updated_at = ?");
  values.push(now());

  const db = await getDb();
  const stmt = db.prepare(
    `UPDATE items SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`,
  );
  await db.batch(ids.map((id) => stmt.bind(...values, id, me.householdId)));

  return json({ ok: true });
});
