import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { getDb, getEnv } from "@/lib/db";
import { readKeys, sendPush, type PushSub } from "@/lib/push";
import { makeT, isLang, DEFAULT_LANG, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Manda una notificación de prueba a los dispositivos de uno mismo. */
export const POST = handler(async () => {
  const me = await requireMe();
  const env = await getEnv();
  const keys = readKeys(env as unknown as Record<string, string>);
  if (!keys) return json({ sent: 0, failed: 0, reason: "no_keys" });

  const db = await getDb();
  const { results } = await db
    .prepare(
      "SELECT id, endpoint, p256dh, auth, lang FROM push_subscriptions WHERE user_id = ?",
    )
    .bind(me.userId)
    .all<PushSub & { lang: string }>();

  const subs = results ?? [];
  const outcomes = await Promise.all(
    subs.map((sub) => {
      const lang: Lang = isLang(sub.lang) ? sub.lang : DEFAULT_LANG;
      const t = makeT(lang);
      return sendPush(
        sub,
        { title: t("push.title"), body: t("push.test"), lang },
        keys,
      );
    }),
  );

  const dead = outcomes.filter((o) => o.gone).map((o) => o.id);
  if (dead.length) {
    await db
      .prepare(
        `DELETE FROM push_subscriptions WHERE id IN (${dead.map(() => "?").join(",")})`,
      )
      .bind(...dead)
      .run();
  }

  const sent = outcomes.filter((o) => o.ok).length;
  return json({
    sent,
    failed: outcomes.length - sent,
    reason: outcomes.length ? undefined : "no_devices",
  });
});
