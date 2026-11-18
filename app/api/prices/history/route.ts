import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { priceHistory } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Historial de precios de un artículo (por nombre): lo pide la ficha al abrirse. */
export const GET = handler(async (req: Request) => {
  const me = await requireMe();
  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) return fail("bad_request");
  return json({ entries: await priceHistory(me.householdId, name) });
});
