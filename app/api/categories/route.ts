import { requireMe } from "@/lib/auth";
import { fail, handler, json, opt } from "@/lib/api";
import { ensureCategory } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as Record<string, unknown>;
  const name = opt(body.name);
  if (!name) return fail("category_name_required");

  return json(await ensureCategory(me.householdId, name));
});
