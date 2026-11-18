import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { listCategories, listItems, listPriceStats, listProducts, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Estado completo de la lista: lo que el cliente refresca al hacer polling. */
export const GET = handler(async () => {
  const me = await requireMe();
  const [stores, categories, items, products, priceStats] = await Promise.all([
    listStores(me.householdId),
    listCategories(me.householdId),
    listItems(me.householdId),
    listProducts(me.householdId),
    listPriceStats(me.householdId),
  ]);
  return json({
    me, stores, categories, items, products, priceStats,
    build: process.env.NEXT_PUBLIC_BUILD_ID,
  });
});
