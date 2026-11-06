import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { listCategories, listItems, listProducts, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Estado completo de la lista: lo que el cliente refresca al hacer polling. */
export const GET = handler(async () => {
  const me = await requireMe();
  const [stores, categories, items, products] = await Promise.all([
    listStores(me.householdId),
    listCategories(me.householdId),
    listItems(me.householdId),
    listProducts(me.householdId),
  ]);
  return json({ me, stores, categories, items, products });
});
