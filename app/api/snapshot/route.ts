import { requireMe } from "@/lib/auth";
import { handler } from "@/lib/api";
import { listCategories, listItems, listPriceStats, listProducts, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Estado completo de la lista: lo que el cliente refresca al hacer polling.
 *
 * Lleva ETag: si el cliente manda el de la última vez y nada ha cambiado, la
 * respuesta es un 304 vacío. La mayoría de refrescos (cada pocos segundos)
 * no descargan nada aunque la lista sea larga.
 */
export const GET = handler(async (req: Request) => {
  const me = await requireMe();
  const [stores, categories, items, products, priceStats] = await Promise.all([
    listStores(me.householdId),
    listCategories(me.householdId),
    listItems(me.householdId),
    listProducts(me.householdId),
    listPriceStats(me.householdId),
  ]);
  const body = JSON.stringify({
    me, stores, categories, items, products, priceStats,
    build: process.env.NEXT_PUBLIC_BUILD_ID,
  });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const etag = `"${[...new Uint8Array(hash).slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
});
