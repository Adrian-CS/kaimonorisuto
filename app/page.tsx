import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { listCategories, listItems, listProducts, listStores } from "@/lib/queries";
import ListView from "@/components/ListView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getMe();
  if (!me) redirect("/login");

  const [stores, categories, items, products] = await Promise.all([
    listStores(me.householdId),
    listCategories(me.householdId),
    listItems(me.householdId),
    listProducts(me.householdId),
  ]);

  return (
    <ListView
      // Componente de servidor: se pinta una vez por petición.
      // eslint-disable-next-line react-hooks/purity
      initial={{ me, stores, categories, items, products, servedAt: Date.now() }}
    />
  );
}
