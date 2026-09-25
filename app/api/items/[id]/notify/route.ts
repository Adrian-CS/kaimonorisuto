import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb, now } from "@/lib/db";
import { notifyHousehold, type NotifyKind } from "@/lib/notify";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Margen mínimo entre dos avisos del mismo artículo. */
const COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Avisa de un artículo que ya está en la lista.
 *
 * Con `toggle`, además cambia el estado de comprado y manda el texto que
 * corresponda al estado resultante. Van juntos a propósito: si el cliente
 * hiciera dos peticiones, el aviso podría describir un estado que ya cambió.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { toggle?: boolean };

  const db = await getDb();
  const item = await db
    .prepare(
      "SELECT name, done, notified_at FROM items WHERE id = ? AND household_id = ?",
    )
    .bind(id, me.householdId)
    .first<{ name: string; done: number; notified_at: number | null }>();
  if (!item) return fail("not_found", 404);

  const t = now();
  let done = item.done;
  let kind: NotifyKind = "ping";

  // El cambio de estado es lo principal: ocurre aunque el aviso se descarte.
  if (body.toggle) {
    done = item.done ? 0 : 1;
    await db
      .prepare("UPDATE items SET done = ?, updated_at = ? WHERE id = ?")
      .bind(done, t, id)
      .run();
    kind = done ? "bought" : "back";
  }

  if (item.notified_at && t - item.notified_at < COOLDOWN_MS) {
    return json({ sent: 0, reason: "too_soon", done });
  }

  const { sent } = await notifyHousehold(me.householdId, me.userId, {
    itemId: id,
    itemName: item.name,
    byName: me.userName,
    kind,
  });

  // Solo cuenta como aviso si de verdad salió alguno: si no hay nadie
  // suscrito, no tiene sentido bloquear el botón durante cinco minutos.
  if (sent > 0) {
    await db
      .prepare("UPDATE items SET notified_at = ? WHERE id = ?")
      .bind(t, id)
      .run();
  }

  return json({ sent, reason: sent ? undefined : "no_devices", done });
});
