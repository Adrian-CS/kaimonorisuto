import { requireMe } from "@/lib/auth";
import { handler, json } from "@/lib/api";
import { getDb, now } from "@/lib/db";
import { nameKey } from "@/lib/money";
import type { ReceiptAlias } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS = new Set(["item", "new", "skip"]);
const MAX = 200;
const text = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

/** Asociaciones aprendidas de líneas de ticket (las pide «Pegar precios»). */
export const GET = handler(async () => {
  const me = await requireMe();
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT label_key, kind, target FROM receipt_aliases WHERE household_id = ?")
    .bind(me.householdId)
    .all<ReceiptAlias>();
  return json({ aliases: results ?? [] });
});

/**
 * Guarda lo ajustado a mano en una revisión:
 * `{ set: [{ label, kind, target }], del: [label] }`.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireMe();
  const body = (await req.json().catch(() => ({}))) as { set?: unknown; del?: unknown };
  const db = await getDb();
  const t = now();
  const stmts: ReturnType<typeof db.prepare>[] = [];

  for (const raw of Array.isArray(body.set) ? body.set.slice(0, MAX) : []) {
    const a = raw as { label?: unknown; kind?: unknown; target?: unknown };
    const label = text(a.label, 80);
    const kind = typeof a.kind === "string" && KINDS.has(a.kind) ? a.kind : null;
    const target = kind === "item" ? text(a.target, 80) : null;
    if (!label || !kind || (kind === "item" && !target)) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO receipt_aliases (household_id, label_key, kind, target, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (household_id, label_key)
           DO UPDATE SET kind = excluded.kind, target = excluded.target, updated_at = excluded.updated_at`,
        )
        .bind(me.householdId, nameKey(label), kind, target, t),
    );
  }
  for (const raw of Array.isArray(body.del) ? body.del.slice(0, MAX) : []) {
    const label = text(raw, 80);
    if (label)
      stmts.push(
        db
          .prepare("DELETE FROM receipt_aliases WHERE household_id = ? AND label_key = ?")
          .bind(me.householdId, nameKey(label)),
      );
  }
  if (stmts.length) await db.batch(stmts);
  return json({ ok: true });
});
