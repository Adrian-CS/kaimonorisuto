import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { isCurrency } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Ajustes del hogar: de momento solo la moneda. */
export const PATCH = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as { currency?: unknown };
  if (!isCurrency(body.currency)) return fail("nothing_to_update");

  const db = await getDb();
  await db
    .prepare("UPDATE households SET currency = ? WHERE id = ?")
    .bind(body.currency, me.householdId)
    .run();

  return json({ ok: true });
});
