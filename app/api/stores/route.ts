import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { getDb, newId, now } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as Record<string, unknown>;
  const name = opt(body.name);
  if (!name) return fail("store_name_required");

  const db = await getDb();

  const dup = await db
    .prepare(
      "SELECT id FROM stores WHERE household_id = ? AND name = ? COLLATE NOCASE",
    )
    .bind(me.householdId, name)
    .first<{ id: string }>();
  if (dup) return json({ id: dup.id });

  const max = await db
    .prepare("SELECT MAX(sort_order) AS m FROM stores WHERE household_id = ?")
    .bind(me.householdId)
    .first<{ m: number | null }>();

  const id = newId();
  await db
    .prepare(
      "INSERT INTO stores (id, household_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, me.householdId, name, opt(body.color), (max?.m ?? 0) + 1, now())
    .run();

  return json({ id });
});
