import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb, now } from "@/lib/db";

export const dynamic = "force-dynamic";

type Move = { id: string; sort_order: number; store_id?: string | null };

/**
 * Guarda el nuevo orden tras arrastrar. Si el artículo ha caído en otro grupo,
 * viene también su nuevo supermercado.
 */
export const PATCH = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as { moves?: Move[] };
  const moves = body.moves;
  if (!Array.isArray(moves) || !moves.length) return fail("nothing_to_update");
  if (moves.length > 500) return fail("nothing_to_update");

  const db = await getDb();
  const t = now();

  await db.batch(
    moves.map((m) =>
      "store_id" in m
        ? db
            .prepare(
              "UPDATE items SET sort_order = ?, store_id = ?, updated_at = ? WHERE id = ? AND household_id = ?",
            )
            .bind(Number(m.sort_order) || 0, m.store_id || null, t, m.id, me.householdId)
        : db
            .prepare(
              "UPDATE items SET sort_order = ?, updated_at = ? WHERE id = ? AND household_id = ?",
            )
            .bind(Number(m.sort_order) || 0, t, m.id, me.householdId),
    ),
  );

  return json({ ok: true });
});
