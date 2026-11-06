"use client";

import { useMemo, useState } from "react";
import Sheet from "./Sheet";
import { useI18n } from "./I18n";
import type { Product } from "@/lib/types";

const fold = (s: string) => s.normalize("NFKC").toLocaleLowerCase().trim();

/**
 * «Lo de siempre»: lo que se ha comprado otras veces, lo más habitual
 * primero. Se marcan varios y se añaden de golpe, cada uno con su foto,
 * tienda, categoría y cantidad. Lo que ya está pendiente en la lista sale
 * apagado para no duplicarlo.
 */
export default function FrequentSheet({
  products,
  pendingNames,
  detail,
  onAdd,
  onForget,
  onClose,
}: {
  products: Product[];
  pendingNames: string[];
  detail: (p: Product) => string;
  onAdd: (list: Product[]) => void;
  onForget: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const pending = useMemo(() => new Set(pendingNames.map(fold)), [pendingNames]);
  const shown = useMemo(() => {
    const q = fold(query);
    return q ? products.filter((p) => fold(p.name).includes(q)) : products;
  }, [products, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    onAdd(products.filter((p) => picked.has(p.id)));
    onClose();
  }

  return (
    <Sheet title={t("frequent.title")} onClose={onClose}>
      {products.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t("frequent.empty")}</p>
      ) : (
        <>
          {products.length > 8 && (
            <input
              className="field mb-3"
              type="search"
              placeholder={t("frequent.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <ul className="mb-3 flex flex-col">
            {shown.map((p) => {
              const inList = pending.has(fold(p.name));
              const on = picked.has(p.id);
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 border-b border-border/70 ${
                    inList ? "opacity-45" : ""
                  }`}
                >
                  <button
                    type="button"
                    disabled={inList}
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    aria-label={t("frequent.pick", { name: p.name })}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                        on ? "border-accent bg-accent text-[#05121f]" : "border-border"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {p.photo_key ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${p.photo_key}`}
                        alt=""
                        loading="lazy"
                        className="h-9 w-9 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="h-9 w-9 shrink-0 rounded-md bg-surface-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {inList ? t("frequent.inList") : detail(p)}
                      </span>
                    </span>
                    {p.times > 1 && (
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        ×{p.times}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 px-2 py-2 text-muted"
                    aria-label={t("frequent.forget", { name: p.name })}
                    onClick={() => {
                      if (window.confirm(t("frequent.forgetConfirm", { name: p.name })))
                        onForget(p.id);
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={picked.size === 0}
            onClick={add}
          >
            {t("frequent.add", { n: picked.size })}
          </button>
        </>
      )}
    </Sheet>
  );
}
