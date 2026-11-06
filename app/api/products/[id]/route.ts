import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { deletePhotoIfUnused } from "@/lib/photos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Quita un producto del histórico (deja de sugerirse). Idempotente. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await db
    .prepare("SELECT photo_key FROM products WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .first<{ photo_key: string | null }>();
  if (!row) return json({ ok: true });
  await db
    .prepare("DELETE FROM products WHERE id = ? AND household_id = ?")
    .bind(id, me.householdId)
    .run();
  await deletePhotoIfUnused(me.householdId, row.photo_key);
  return json({ ok: true });
});
