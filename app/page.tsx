import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { listItems, listStores } from "@/lib/queries";
import ListView from "@/components/ListView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getMe();
  if (!me) redirect("/login");

  const [stores, items] = await Promise.all([
    listStores(me.householdId),
    listItems(me.householdId),
  ]);

  return <ListView initial={{ me, stores, items }} />;
}
