import { getDb, getEnv } from "./db";
import { readKeys, sendPush, type PushSub } from "./push";
import { makeT, isLang, DEFAULT_LANG, type Key, type Lang } from "./i18n";

type Row = PushSub & { lang: string };

/** Qué provocó el aviso: cambia solo el texto del cuerpo. */
export type NotifyKind = "added" | "ping" | "bought" | "back";

const BODY_KEY: Record<NotifyKind, Key> = {
  added: "push.body",
  ping: "push.ping",
  bought: "push.bought",
  back: "push.back",
};

/**
 * Avisa a los demás miembros del hogar (nunca a quien lo provoca), cada uno en
 * su idioma. Silencioso si no hay claves VAPID o nadie está suscrito.
 *
 * Devuelve cuántos avisos salieron, para poder decírselo a quien lo pidió.
 */
export async function notifyHousehold(
  householdId: string,
  exceptUserId: string,
  body: { itemId: string; itemName: string; byName: string; kind: NotifyKind },
): Promise<{ sent: number; failed: number }> {
  const env = await getEnv();
  const keys = readKeys(env as unknown as Record<string, string>);
  if (!keys) return { sent: 0, failed: 0 };

  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.lang
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.household_id = ? AND u.id != ?`,
    )
    .bind(householdId, exceptUserId)
    .all<Row>();

  const subs = results ?? [];
  if (!subs.length) return { sent: 0, failed: 0 };

  const outcomes = await Promise.all(
    subs.map((sub) => {
      const lang: Lang = isLang(sub.lang) ? sub.lang : DEFAULT_LANG;
      const t = makeT(lang);
      return sendPush(
        sub,
        {
          title: t("push.title"),
          body: t(BODY_KEY[body.kind], { name: body.byName, item: body.itemName }),
          lang,
          // Un tag por artículo: con un tag fijo cada aviso borraría el anterior.
          tag: `item:${body.itemId}`,
        },
        keys,
      );
    }),
  );

  // Limpia las suscripciones que el push service da por muertas.
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
  return { sent, failed: outcomes.length - sent };
}
