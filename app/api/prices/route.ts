import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { recallPrice } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Precio recordado de un producto, para sugerirlo en el editor. */
export const GET = handler(async (req: Request) => {
  const me = await requireMe();
  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim();
  if (!name) return json({ price: null });

  const price = await recallPrice(
    me.householdId,
    name,
    url.searchParams.get("store_id") || null,
  );
  return json({ price });
});
