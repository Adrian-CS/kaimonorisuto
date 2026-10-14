import { requireMe } from "@/lib/auth";
import { clientId, fail, handler, json, opt } from "@/lib/api";
import { sameName } from "@/lib/names";
import { getDb, newId, now } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as Record<string, unknown>;
  const name = opt(body.name);
  if (!name) return fail("store_name_required");

  const db = await getDb();

  // Si ya hay una con ese nombre (o es un reintento con el mismo id), se
  // devuelve esa. El cliente cambia su id provisional por este si difiere.
  const wanted = clientId(body.id);
  const { results } = await db
    .prepare("SELECT id, name, sort_order FROM stores WHERE household_id = ?")
    .bind(me.householdId)
    .all<{ id: string; name: string; sort_order: number }>();
  const all = results ?? [];
  const dup = all.find((s) => s.id === wanted || sameName(s.name, name));
  if (dup) return json({ id: dup.id });

  const max = Math.max(0, ...all.map((s) => s.sort_order));
  const id = wanted ?? newId();
  await db
    .prepare(
      "INSERT INTO stores (id, household_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, me.householdId, name, opt(body.color), max + 1, now())
    .run();

  return json({ id });
});
