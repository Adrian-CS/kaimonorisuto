"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { useI18n } from "./I18n";
import { errorText, type Key } from "@/lib/i18n";
import { compressImage } from "@/lib/image";
import {
  formatMoney,
  moneyToInput,
  parseMoney,
  type Currency,
} from "@/lib/money";
import type { Item, Store } from "@/lib/types";

export type ItemPatch = Partial<
  Pick<
    Item,
    "name" | "qty" | "category" | "note" | "store_id" | "photo_key" | "price"
  >
>;

export default function ItemSheet({
  item,
  stores,
  categories,
  currency,
  onClose,
  onSave,
  onDelete,
  onCreateStore,
  onNotify,
}: {
  item: Item;
  stores: Store[];
  categories: string[];
  currency: Currency;
  onClose: () => void;
  onSave: (patch: ItemPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateStore: (name: string) => Promise<string | null>;
  onNotify: () => Promise<{ sent: number; reason?: string }>;
}) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(moneyToInput(item.price, currency));
  const [suggested, setSuggested] = useState<number | null>(null);
  const [qty, setQty] = useState(item.qty ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [storeId, setStoreId] = useState(item.store_id ?? "");
  const [photoKey, setPhotoKey] = useState(item.photo_key);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<Key | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Muestra los campos opcionales solo si ya tienen contenido: la lista
  // puede usarse como algo súper simple y crecer cuando haga falta.
  const [showExtra, setShowExtra] = useState(
    Boolean(item.qty || item.category || item.note || item.price !== null),
  );

  // Si no hay precio puesto, busca el que se recordó de este mismo producto.
  useEffect(() => {
    if (price.trim() || !name.trim()) {
      setSuggested(null);
      return;
    }
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams({ name: name.trim() });
      if (storeId) qs.set("store_id", storeId);
      try {
        const res = await fetch(`/api/prices?${qs}`, { cache: "no-store" });
        const data = (await res.json()) as { price: number | null };
        setSuggested(data.price);
      } catch {
        setSuggested(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [name, storeId, price]);

  async function pickPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const small = await compressImage(file);
      const form = new FormData();
      form.append("file", small);
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        key?: string;
        error?: string;
      };
      if (!res.ok || !data.key) {
        setError(errorText(t, data.error ?? "upload_failed"));
        return;
      }
      setPhotoKey(data.key);
    } catch {
      setError(t("error.upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  // iOS no siempre deja el campo enfocado a la vista al abrirse el teclado.
  function keepInView(e: React.FocusEvent<HTMLElement>) {
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
  }

  async function addStore() {
    const n = window.prompt(t("store.promptNew"));
    if (!n?.trim()) return;
    const id = await onCreateStore(n.trim());
    if (id) setStoreId(id);
  }

  async function notify() {
    setNotifying(true);
    setNotifyMsg(null);
    try {
      const { sent, reason } = await onNotify();
      setNotifyMsg(
        sent > 0
          ? "item.notifySent"
          : reason === "too_soon"
            ? "item.notifyTooSoon"
            : reason === "no_devices"
              ? "item.notifyNoOthers"
              : "item.notifyFailed",
      );
    } finally {
      setNotifying(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError(t("error.item_name_required"));
      return;
    }
    const parsedPrice = price.trim() ? parseMoney(price, currency) : null;
    if (price.trim() && parsedPrice === null) {
      setError(t("error.price_invalid"));
      return;
    }

    await onSave({
      name: name.trim(),
      price: parsedPrice,
      qty: qty.trim() || null,
      category: category.trim() || null,
      note: note.trim() || null,
      store_id: storeId || null,
      photo_key: photoKey,
    });
    onClose();
  }

  return (
    <Sheet title={t("item.edit")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("item.name")}
          onFocus={keepInView}
        />

        {/* Foto */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2"
          >
            {photoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${photoKey}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">📷</span>
            )}
          </button>
          <div className="text-sm text-muted">
            {uploading ? (
              t("item.uploading")
            ) : photoKey ? (
              <button
                type="button"
                className="text-danger"
                onClick={() => setPhotoKey(null)}
              >
                {t("item.photoRemove")}
              </button>
            ) : (
              t("item.photoHelp")
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickPhoto(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Supermercado */}
        <div className="flex gap-2">
          <select
            className="field"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="">{t("store.none")}</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn shrink-0"
            onClick={addStore}
            aria-label={t("common.add")}
          >
            +
          </button>
        </div>

        {showExtra ? (
          <>
            <div className="flex items-center gap-2">
              <input
                className="field"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("item.price")}
                onFocus={keepInView}
                inputMode="decimal"
              />
              {suggested !== null && (
                <button
                  type="button"
                  className="btn shrink-0 text-xs whitespace-nowrap"
                  onClick={() => setPrice(moneyToInput(suggested, currency))}
                >
                  {t("item.priceSuggest", {
                    price: formatMoney(suggested, currency, lang),
                  })}
                </button>
              )}
            </div>
            <input
              className="field"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={t("item.qty")}
                onFocus={keepInView}
            />
            <input
              className="field"
              list="categorias"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("item.category")}
                onFocus={keepInView}
            />
            <datalist id="categorias">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <textarea
              className="field"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("item.note")}
                onFocus={keepInView}
            />
          </>
        ) : (
          <button
            type="button"
            className="self-start text-sm text-accent"
            onClick={() => setShowExtra(true)}
          >
            {t("item.showExtra")}
          </button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {/* Avisar de algo que ya está en la lista, sin tener que volver a añadirlo. */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={notify}
            disabled={notifying}
            aria-label={t("item.notify")}
          >
            🔔 {t("item.notify")}
          </button>
          {notifyMsg && (
            <span
              className={`text-xs ${
                notifyMsg === "item.notifySent" ? "text-muted" : "text-danger"
              }`}
            >
              {t(notifyMsg)}
            </span>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (window.confirm(t("item.deleteConfirm", { name: item.name }))) {
                await onDelete();
                onClose();
              }
            }}
          >
            {t("common.delete")}
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={save}
            disabled={uploading}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
