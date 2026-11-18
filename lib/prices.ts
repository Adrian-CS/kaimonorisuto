import type { PriceEntry, PriceStats } from "./types";

/** Mediana de una lista de precios (redondeada al entero). */
export function median(prices: number[]): number {
  const s = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Resumen de unas cuantas entradas: lo que va en la fila de la lista. */
export function summarize(entries: PriceEntry[]): PriceStats {
  const prices = entries.map((e) => e.price);
  return {
    median: median(prices),
    min: Math.min(...prices),
    max: Math.max(...prices),
    n: prices.length,
  };
}

export type PriceGroup = {
  key: string;
  median: number;
  n: number;
  /** Fecha de la compra más reciente del grupo. */
  last: number;
};

/**
 * Agrupa el historial (más reciente primero) y resume cada grupo: por tienda
 * («dónde sale más barato») o por lo que ponía el ticket («豚こま» dentro de
 * «肉»). Ordenado de más barato a más caro.
 */
export function groupPrices(
  entries: PriceEntry[],
  keyOf: (e: PriceEntry) => string | null,
): PriceGroup[] {
  const groups = new Map<string, PriceEntry[]>();
  for (const e of entries) {
    const k = keyOf(e);
    if (k === null) continue;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      median: median(list.map((e) => e.price)),
      n: list.length,
      last: Math.max(...list.map((e) => e.at)),
    }))
    .sort((a, b) => a.median - b.median);
}

/**
 * Fecha de un ticket («2026-11-14», «2026/11/14») como instante: a mediodía
 * UTC, para que caiga en ese día tanto en Japón como en España. `null` si no
 * es una fecha válida o es absurda (futura o de hace más de 5 años).
 */
export function receiptDate(v: unknown, now = Date.now()): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = Date.UTC(y, mo - 1, d, 12);
  const back = new Date(at);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  const DAY = 86400000;
  if (at > now + DAY || at < now - 5 * 365 * DAY) return null;
  return at;
}
