import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb, now } from "@/lib/db";
import { storeIdsFromBody } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Move = {
  id: string;
  sort_order: number;
  store_ids?: string[];
  /** De clientes antiguos. */
  store_id?: string | null;
  category?: string | null;
};

/**
 * Guarda el nuevo orden tras arrastrar. Si el artículo ha caído en otro grupo,
 * viene también su nuevo supermercado o su nueva categoría.
 */
export const PATCH = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as { moves?: Move[] };
  const moves = body.moves;
  if (!Array.isArray(moves) || !moves.length) return fail("nothing_to_update");
  if (moves.length > 500) return fail("nothing_to_update");

  const db = await getDb();
  const t = now();

  const stmts = await Promise.all(
    moves.map(async (m) => {
      const sets = ["sort_order = ?", "updated_at = ?"];
      const values: (string | number | null)[] = [Number(m.sort_order) || 0, t];
      const storeIds = await storeIdsFromBody(me.householdId, m);
      if (storeIds) {
        sets.push("store_ids = ?");
        values.push(JSON.stringify(storeIds));
      }
      if ("category" in m) {
        // Solo se puede soltar en un grupo que ya existe, así que no hace
        // falta dar de alta la categoría.
        sets.push("category = ?");
        values.push(opt(m.category));
      }
      return db
        .prepare(
          `UPDATE items SET ${sets.join(", ")} WHERE id = ? AND household_id = ?`,
        )
        .bind(...values, m.id, me.householdId);
    }),
  );
  await db.batch(stmts);

  return json({ ok: true });
});
