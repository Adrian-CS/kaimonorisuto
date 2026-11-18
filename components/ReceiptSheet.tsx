"use client";

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { useI18n } from "./I18n";
import { sameName } from "@/lib/names";
import { formatMoney, moneyToInput, parseMoney, type Currency } from "@/lib/money";
import { parseReceiptText, type Receipt } from "@/lib/receipt";
import { nameKey } from "@/lib/money";
import type { Item, ReceiptAlias, Store } from "@/lib/types";

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

/**
 * Valor del desplegable para «añadir a la lista, ya comprado»: solo, con el
 * nombre de la línea; `__nuevo__:肉`, con otro nombre (una asociación
 * aprendida cuyo artículo ya no está en la lista).
 */
const NEW = "__nuevo__";
const NEW_AS = `${NEW}:`;

/** Lo elegido para una línea, comparable con lo que sale solo. */
type Choice = { kind: ReceiptAlias["kind"]; target: string | null };
const sameChoice = (a: Choice, b: Choice) =>
  a.kind === b.kind && nameKey(a.target ?? "") === nameKey(b.target ?? "");

export type LearnedAliases = {
  set: { label: string; kind: ReceiptAlias["kind"]; target: string | null }[];
  del: string[];
};

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
  onLearn,
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
    added: { name: string; price: number; label: string }[],
    storeId: string | null,
    /** Día del ticket («2026-11-14»): el historial lo guarda en esa fecha. */
    date: string | null,
  ) => void;
  /** Lo ajustado a mano, para que la próxima vez salga ya así. */
  onLearn: (learned: LearnedAliases) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [storeId, setStoreId] = useState("");

  // Asociaciones aprendidas de otras veces. Sin conexión no hay: se empareja
  // solo por nombre, como siempre.
  const [aliases, setAliases] = useState<Map<string, ReceiptAlias>>(new Map());
  useEffect(() => {
    let live = true;
    fetch("/api/receipt-aliases", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { aliases: [] }))
      .then((d: { aliases: ReceiptAlias[] }) => {
        if (live) setAliases(new Map(d.aliases.map((a) => [a.label_key, a])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const byName = [...items].sort((a, b) => a.name.localeCompare(b.name, lang));

  /** Valor del desplegable para una línea: lo aprendido, o si no, por nombre. */
  function pick(name: string, useAliases = true): string {
    const a = useAliases ? aliases.get(nameKey(name)) : undefined;
    if (a?.kind === "skip") return "";
    if (a?.kind === "new") return items.find((i) => sameName(i.name, name))?.id ?? NEW;
    if (a?.kind === "item" && a.target)
      return items.find((i) => sameName(i.name, a.target!))?.id ?? NEW_AS + a.target;
    return matchItem(name, items)?.id ?? "";
  }

  /** Qué significa un valor del desplegable, para comparar y aprender. */
  function choiceOf(value: string): Choice {
    if (value === "") return { kind: "skip", target: null };
    if (value === NEW) return { kind: "new", target: null };
    if (value.startsWith(NEW_AS)) return { kind: "item", target: value.slice(NEW_AS.length) };
    return { kind: "item", target: items.find((i) => i.id === value)?.name ?? null };
  }

  function review() {
    const r = parseReceiptText(text, currency);
    setReceipt(r);
    setPicking(null);
    setStoreId(r.store ? (stores.find((s) => sameName(s.name, r.store!))?.id ?? "") : "");
    setRows(
      r.lines.map((l) => {
        const itemId = pick(l.name);
        return {
          name: l.name,
          itemId,
          price: moneyToInput(l.price, currency),
          on: Boolean(itemId),
        };
      }),
    );
  }

  /**
   * Lo que se ha elegido distinto de lo que saldría solo por nombre se
   * recuerda; si se vuelve a lo de por nombre, se olvida lo aprendido.
   */
  function learned(): LearnedAliases {
    const out: LearnedAliases = { set: [], del: [] };
    for (const r of rows) {
      const chosen = choiceOf(r.itemId);
      if (chosen.kind === "item" && !chosen.target) continue;
      if (!sameChoice(chosen, choiceOf(pick(r.name, false))))
        out.set.push({ label: r.name, ...chosen });
      else if (aliases.has(nameKey(r.name))) out.del.push(r.name);
    }
    return out;
  }

  // Fila cuyo buscador de artículo está abierto, y lo que se busca.
  const [picking, setPicking] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const q = fold(query);
  const found = q ? byName.filter((it) => fold(it.name).includes(q)) : byName;

  /** Cómo se lee lo elegido para una línea. */
  function choiceText(value: string): string {
    if (value === "") return t("receipt.notInList");
    if (value === NEW) return t("receipt.addNew");
    if (value.startsWith(NEW_AS)) return t("receipt.addAs", { name: value.slice(NEW_AS.length) });
    const it = items.find((x) => x.id === value);
    if (!it) return t("receipt.notInList");
    return `→ ${it.name}${it.price !== null ? ` (${formatMoney(it.price, currency, lang)})` : ""}`;
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const priced = rows
    .filter((r) => r.on && r.itemId)
    .map((r) => ({ ...r, value: parseMoney(r.price, currency) }))
    .filter((r): r is Row & { value: number } => r.value !== null);
  const isNew = (id: string) => id === NEW || id.startsWith(NEW_AS);
  const ready = priced
    .filter((r) => !isNew(r.itemId))
    .map((r) => ({ itemId: r.itemId, price: r.value, label: r.name }));
  const added = priced
    .filter((r) => isNew(r.itemId))
    .map((r) => ({
      name: r.itemId === NEW ? r.name : r.itemId.slice(NEW_AS.length),
      price: r.value,
      label: r.name,
    }));

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
                <button
                  type="button"
                  className="field flex items-center gap-2 py-1 text-left text-sm"
                  aria-label={t("receipt.item", { name: r.name })}
                  aria-expanded={picking === i}
                  onClick={() => {
                    setPicking(picking === i ? null : i);
                    setQuery("");
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{choiceText(r.itemId)}</span>
                  <span className="shrink-0 text-muted">🔍</span>
                </button>
                {picking === i && (
                  // Buscador en vez de desplegable: con muchos artículos, buscar
                  // «肉» es más rápido que bajar por toda la lista.
                  <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
                    <input
                      className="field py-1 text-sm"
                      type="search"
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("receipt.search")}
                      aria-label={t("receipt.search")}
                    />
                    <ul className="flex max-h-56 flex-col overflow-y-auto text-sm" role="listbox">
                      {[
                        ...(query ? [] : [{ value: "", text: t("receipt.notInList") }]),
                        { value: NEW, text: t("receipt.addNew") },
                        ...(r.itemId.startsWith(NEW_AS) ? [{ value: r.itemId, text: choiceText(r.itemId) }] : []),
                        ...found.map((it) => ({ value: it.id, text: choiceText(it.id) })),
                      ].map((o) => (
                        <li key={o.value || "none"}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={o.value === r.itemId}
                            className={`w-full truncate rounded-md px-2 py-1.5 text-left ${
                              o.value === r.itemId ? "bg-accent/15 text-accent" : ""
                            }`}
                            onClick={() => {
                              update(i, { itemId: o.value, on: !!o.value });
                              setPicking(null);
                            }}
                          >
                            {o.text}
                          </button>
                        </li>
                      ))}
                      {query && found.length === 0 && (
                        <li className="px-2 py-1.5 text-muted">{t("receipt.noMatch")}</li>
                      )}
                    </ul>
                  </div>
                )}
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
                onApply(ready, added, storeId || null, receipt.date);
                const l = learned();
                if (l.set.length || l.del.length) onLearn(l);
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
