"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useI18n } from "./I18n";
import { sameName } from "@/lib/names";
import { formatMoney, moneyToInput, parseMoney, type Currency } from "@/lib/money";
import { parseReceiptText, type Receipt } from "@/lib/receipt";
import type { Item, Store } from "@/lib/types";

const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");

/**
 * Artículo de la lista que corresponde a una línea del ticket: el del mismo
 * nombre, y si no hay, el que contiene al otro («牛乳» ↔ «低脂肪牛乳»), el más
 * parecido en longitud.
 */
function matchItem(name: string, items: Item[]): Item | null {
  const exact = items.find((i) => sameName(i.name, name));
  if (exact) return exact;
  const n = fold(name);
  if (n.length < 2) return null;
  const close = items
    .filter((i) => {
      const f = fold(i.name);
      return f.length >= 2 && (f.includes(n) || n.includes(f));
    })
    .sort((a, b) => Math.abs(a.name.length - name.length) - Math.abs(b.name.length - name.length));
  return close[0] ?? null;
}

/** Valor del desplegable para «añadir a la lista, ya comprado». */
const NEW = "__nuevo__";

type Row = { name: string; itemId: string; price: string; on: boolean };

/**
 * «Pegar precios»: el texto de un ticket ya pasado a limpio (ver
 * lib/receipt.ts) → revisión línea a línea → precios guardados. Nada se toca
 * hasta pulsar Guardar.
 */
export default function ReceiptSheet({
  items,
  stores,
  currency,
  onApply,
  onClose,
}: {
  items: Item[];
  stores: Store[];
  currency: Currency;
  /**
   * `changes`: precios para artículos de la lista (con lo que ponía el ticket,
   * para el historial). `added`: líneas que no estaban en la lista y se añaden
   * ya compradas.
   */
  onApply: (
    changes: { itemId: string; price: number; label: string }[],
    added: { name: string; price: number }[],
    storeId: string | null,
  ) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [storeId, setStoreId] = useState("");

  const byName = [...items].sort((a, b) => a.name.localeCompare(b.name, lang));

  function review() {
    const r = parseReceiptText(text, currency);
    setReceipt(r);
    setStoreId(r.store ? (stores.find((s) => sameName(s.name, r.store!))?.id ?? "") : "");
    setRows(
      r.lines.map((l) => {
        const item = matchItem(l.name, items);
        return {
          name: l.name,
          itemId: item?.id ?? "",
          price: moneyToInput(l.price, currency),
          on: Boolean(item),
        };
      }),
    );
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const priced = rows
    .filter((r) => r.on && r.itemId)
    .map((r) => ({ ...r, value: parseMoney(r.price, currency) }))
    .filter((r): r is Row & { value: number } => r.value !== null);
  const ready = priced
    .filter((r) => r.itemId !== NEW)
    .map((r) => ({ itemId: r.itemId, price: r.value, label: r.name }));
  const added = priced
    .filter((r) => r.itemId === NEW)
    .map((r) => ({ name: r.name, price: r.value }));

  return (
    <Sheet title={t("receipt.title")} onClose={onClose}>
      {!receipt ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("receipt.help")}</p>
          <textarea
            id="receipt-text"
            className="field font-mono text-sm"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"🧾 西友 2026-11-14\n牛乳 238\n卵 268"}
            aria-label={t("receipt.title")}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!text.trim()}
            onClick={review}
          >
            {t("receipt.review")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">🧾</span>
            <select
              className="field"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              aria-label={t("receipt.store")}
            >
              <option value="">{t("store.none")}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {receipt.date && <span className="shrink-0 text-xs text-muted">{receipt.date}</span>}
          </label>

          {rows.length === 0 && (
            <p className="text-sm text-danger">{t("receipt.nothing")}</p>
          )}

          <ul className="flex flex-col">
            {rows.map((r, i) => (
              <li
                key={i}
                className={`flex flex-col gap-1.5 border-b border-border/70 py-2 ${r.on ? "" : "opacity-50"}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.on}
                    onChange={(e) => update(i, { on: e.target.checked })}
                    aria-label={t("receipt.use", { name: r.name })}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <input
                    // .field ocupa todo el ancho; aquí el nombre va al lado.
                    className="field shrink-0 py-1 text-right tabular-nums"
                    style={{ width: "6.5rem" }}
                    inputMode="decimal"
                    value={r.price}
                    onChange={(e) => update(i, { price: e.target.value })}
                    aria-label={t("receipt.price", { name: r.name })}
                  />
                </div>
                <select
                  className="field py-1 text-sm"
                  value={r.itemId}
                  onChange={(e) => update(i, { itemId: e.target.value, on: !!e.target.value })}
                  aria-label={t("receipt.item", { name: r.name })}
                >
                  <option value="">{t("receipt.notInList")}</option>
                  <option value={NEW}>{t("receipt.addNew")}</option>
                  {byName.map((it) => (
                    <option key={it.id} value={it.id}>
                      → {it.name}
                      {it.price !== null ? ` (${formatMoney(it.price, currency, lang)})` : ""}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          {receipt.skipped.length > 0 && (
            <details className="text-xs text-muted">
              <summary>{t("receipt.skipped", { n: receipt.skipped.length })}</summary>
              <ul className="mt-1 list-disc pl-5">
                {receipt.skipped.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setReceipt(null)}>
              {t("receipt.back")}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={priced.length === 0}
              onClick={() => {
                onApply(ready, added, storeId || null);
                onClose();
              }}
            >
              {t("receipt.save", { n: priced.length })}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
