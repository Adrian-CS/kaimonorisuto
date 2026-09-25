import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb, getEnv, newId, now } from "@/lib/db";
import { readKeys } from "@/lib/push";
import { DEFAULT_LANG, isLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** La clave pública VAPID y si este dispositivo ya está suscrito. */
export const GET = handler(async () => {
  const me = await requireMe();
  const env = await getEnv();
  const keys = readKeys(env as unknown as Record<string, string>);
  if (!keys) return json({ enabled: false });

  const db = await getDb();
  const mine = await db
    .prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?")
    .bind(me.userId)
    .first<{ n: number }>();

  const others = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.household_id = ? AND u.id != ?`,
    )
    .bind(me.householdId, me.userId)
    .first<{ n: number }>();

  return json({
    enabled: true,
    publicKey: keys.publicKey,
    myDevices: mine?.n ?? 0,
    otherDevices: others?.n ?? 0,
  });
});

/** Registra (o refresca) la suscripción de este navegador. */
export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    lang?: string;
  };

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) return fail("missing_fields");

  const lang = isLang(body.lang) ? body.lang : DEFAULT_LANG;
  const db = await getDb();

  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, lang, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         lang = excluded.lang`,
    )
    .bind(newId(), me.userId, endpoint, p256dh, auth, lang, now())
    .run();

  return json({ ok: true });
});

/** Da de baja este navegador. */
export const DELETE = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  const db = await getDb();

  if (body.endpoint) {
    await db
      .prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
      .bind(me.userId, body.endpoint)
      .run();
  } else {
    await db
      .prepare("DELETE FROM push_subscriptions WHERE user_id = ?")
      .bind(me.userId)
      .run();
  }

  return json({ ok: true });
});
