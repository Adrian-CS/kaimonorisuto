"use client";

import { useState } from "react";
import { useI18n } from "./I18n";
import { formatMoney, type Currency } from "@/lib/money";
import { groupPrices, type PriceGroup } from "@/lib/prices";
import type { PriceEntry, PriceStats, Store } from "@/lib/types";

const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
/** Compras que se ven sin pulsar «ver más». */
const FIRST = 8;

/**
 * Lo que ha costado un artículo otras veces. Plegado enseña el resumen (va
 * con la lista); al abrirlo pide el historial y enseña:
 * - por tienda, si se ha comprado en más de una: dónde sale más barato;
 * - por tipo, si el ticket ponía cosas distintas («豚こま», «鶏もも» dentro
 *   de «肉»);
 * - las compras, de la más reciente a la más antigua.
 */
export default function PriceHistory({
  name,
  summary,
  stores,
  currency,
}: {
  name: string;
  summary: PriceStats;
  stores: Store[];
  currency: Currency;
}) {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<PriceEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const money = (n: number) => formatMoney(n, currency, lang);

  async function load() {
    if (entries) return;
    try {
      const res = await fetch(`/api/prices/history?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setEntries(((await res.json()) as { entries: PriceEntry[] }).entries);
      setFailed(false);
    } catch {
      setFailed(true); // sin conexión: queda el resumen
    }
  }

  const thisYear = new Date().getFullYear();
  const day = (at: number) =>
    new Date(at).toLocaleDateString(lang, {
      month: "short",
      day: "numeric",
      ...(new Date(at).getFullYear() !== thisYear && { year: "numeric" }),
    });
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? null;

  const byStore = entries ? groupPrices(entries, (e) => e.store_id ?? "") : [];
  // Por tipo: agrupa lo que ponía el ticket sin mirar mayúsculas ni espacios,
  // y lo enseña con la forma más reciente.
  const labelOf = new Map<string, string>();
  for (const e of entries ?? []) if (e.label && !labelOf.has(fold(e.label))) labelOf.set(fold(e.label), e.label);
  const byKind = entries ? groupPrices(entries, (e) => (e.label ? fold(e.label) : null)) : [];
  const shown = all ? (entries ?? []) : (entries ?? []).slice(0, FIRST);

  const groupList = (title: string, groups: PriceGroup[], label: (g: PriceGroup) => string, testId: string) => (
    <div data-testid={testId}>
      <p className="mb-1 font-medium text-text">{title}</p>
      <ul className="flex flex-col gap-1">
        {groups.map((g) => (
          <li key={g.key} className="flex gap-2">
            <span className="min-w-0 flex-1 truncate">{label(g)}</span>
            <span className="shrink-0 tabular-nums">
              {t("price.times", { n: g.n })} · {day(g.last)}
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums">
              {g.n >= 2 && "≈"}
              {money(g.median)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <details
      className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted"
      onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void load()}
    >
      <summary className="cursor-pointer">
        {summary.n >= 2
          ? t("price.summary", {
              median: money(summary.median),
              min: money(summary.min),
              max: money(summary.max),
              n: summary.n,
            })
          : t("price.once", { price: money(summary.min) })}
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {failed && <p>{t("price.historyOffline")}</p>}
        {!entries && !failed && <p>…</p>}
        {byStore.length >= 2 &&
          groupList(t("price.byStore"), byStore, (g) => storeName(g.key) ?? t("store.none"), "price-by-store")}
        {byKind.length >= 2 &&
          groupList(t("price.byKind"), byKind, (g) => labelOf.get(g.key) ?? g.key, "price-by-kind")}
        {entries && entries.length > 0 && (
          <div>
            {(byStore.length >= 2 || byKind.length >= 2) && (
              <p className="mb-1 font-medium text-text">{t("price.purchases")}</p>
            )}
            <ul className="flex flex-col gap-1" data-testid="price-entries">
              {shown.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-14 shrink-0 tabular-nums">{day(e.at)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {[e.label, storeName(e.store_id)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="shrink-0 tabular-nums">{money(e.price)}</span>
                </li>
              ))}
            </ul>
            {!all && entries.length > FIRST && (
              <button type="button" className="mt-1 text-accent" onClick={() => setAll(true)}>
                {t("price.more", { n: entries.length - FIRST })}
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
