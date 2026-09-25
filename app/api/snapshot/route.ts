import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { listItems, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Estado completo de la lista: lo que el cliente refresca al hacer polling. */
export const GET = handler(async () => {
  const me = await requireMe();
  const [stores, items] = await Promise.all([
    listStores(me.householdId),
    listItems(me.householdId),
  ]);
  return json({ me, stores, items });
});
