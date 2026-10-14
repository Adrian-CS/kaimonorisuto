"use client";

import { useEffect, useRef, useState } from "react";
import PhotoViewer from "./PhotoViewer";
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
import type { Category, Item, Store } from "@/lib/types";

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
  onCreateCategory,
  onNotify,
  offline,
}: {
  item: Item;
  stores: Store[];
  categories: Category[];
  currency: Currency;
  onClose: () => void;
  onSave: (patch: ItemPatch) => void;
  onDelete: () => void;
  onCreateStore: (name: string) => string | null;
  onCreateCategory: (name: string) => string | null;
  /** Sin conexión no se pueden subir fotos; todo lo demás sí. */
  offline: boolean;
  onNotify: () => Promise<{ sent: number; reason?: string }>;
}) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(moneyToInput(item.price, currency));
  // Precio recordado para el nombre y la tienda con que se pidió: solo se
  // enseña mientras sigan siendo esos y el campo de precio esté vacío.
  const [suggestion, setSuggestion] = useState<{
    query: string;
    price: number | null;
  } | null>(null);
  const [qty, setQty] = useState(item.qty ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [storeId, setStoreId] = useState(item.store_id ?? "");
  const [photoKey, setPhotoKey] = useState(item.photo_key);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<Key | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState(false);
  const uploaded = useRef(new Set<string>());

  // Muestra los campos opcionales solo si ya tienen contenido: la lista
  // puede usarse como algo súper simple y crecer cuando haga falta.
  const [showExtra, setShowExtra] = useState(
    Boolean(item.qty || item.category || item.note || item.price !== null),
  );

  // Si no hay precio puesto, busca el que se recordó de este mismo producto.
  const qs = new URLSearchParams({ name: name.trim() });
  if (storeId) qs.set("store_id", storeId);
  const query = qs.toString();
  const wantSuggestion = !price.trim() && Boolean(name.trim());
  const suggested =
    wantSuggestion && suggestion?.query === query ? suggestion.price : null;

  useEffect(() => {
    if (!wantSuggestion) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/prices?${query}`, { cache: "no-store" });
        const data = (await res.json()) as { price: number | null };
        setSuggestion({ query, price: data.price });
      } catch {
        /* sin conexión: sin sugerencia */
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, wantSuggestion]);

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
      uploaded.current.add(data.key);
      setPhotoKey(data.key);
    } catch {
      setError(t("error.upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void pickPhoto(f);
    e.target.value = "";
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

  async function addCategory() {
    const n = window.prompt(t("category.promptNew"));
    if (!n?.trim()) return;
    const saved = await onCreateCategory(n.trim());
    if (saved) setCategory(saved);
  }

  async function notify() {
    setNotifying(true);
    setNotifyMsg(null);
    try {
      const { sent, reason } = await onNotify();
      setNotifyMsg(
        sent > 0
          ? "item.notifySent"
          : reason === "queued"
            ? "item.notifyQueued"
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

    onSave({
      name: name.trim(),
      price: parsedPrice,
      qty: qty.trim() || null,
      category: category.trim() || null,
      note: note.trim() || null,
      store_id: storeId || null,
      photo_key: photoKey,
    });
    close(photoKey);
  }

  /**
   * Cierra la ficha y borra de R2 las fotos subidas en ella que al final no
   * se quedan (se cambiaron por otra o no se guardó). `kept` es la que queda.
   */
  function close(kept: string | null = item.photo_key) {
    for (const key of uploaded.current)
      if (key !== kept)
        void fetch(`/api/photos/${key}`, { method: "DELETE" }).catch(() => {});
    onClose();
  }

  return (
    <Sheet title={t("item.edit")} onClose={() => close()}>
      <div className="flex flex-col gap-3">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("item.name")}
          onFocus={keepInView}
        />

        {/* Foto: tocarla la amplía; hacerla o cambiarla va con los botones. */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              photoKey ? setViewing(true) : !offline && cameraRef.current?.click()
            }
            aria-label={photoKey ? t("photo.enlarge") : t("photo.camera")}
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
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-muted">
            {uploading ? (
              t("item.uploading")
            ) : (
              <>
                {offline ? (
                  <span className="text-xs">{t("photo.offline")}</span>
                ) : (
                  !photoKey && <span className="text-xs">{t("item.photoHelp")}</span>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn px-2.5 py-1 text-xs disabled:opacity-40"
                    disabled={offline}
                    onClick={() => cameraRef.current?.click()}
                  >
                    📷 {t("photo.camera")}
                  </button>
                  <button
                    type="button"
                    className="btn px-2.5 py-1 text-xs disabled:opacity-40"
                    disabled={offline}
                    onClick={() => albumRef.current?.click()}
                  >
                    🖼️ {t("photo.album")}
                  </button>
                  {photoKey && (
                    <button
                      type="button"
                      className="px-1 text-xs text-danger"
                      onClick={() => setPhotoKey(null)}
                    >
                      {t("item.photoRemove")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Con capture, el móvil va directo a la cámara; sin él, deja
              elegir de la galería. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-photo-input="camera"
            onChange={onFile}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-photo-input="album"
            onChange={onFile}
          />
        </div>

        {viewing && photoKey && (
          <PhotoViewer
            src={`/api/photos/${photoKey}`}
            onClose={() => setViewing(false)}
          />
        )}

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
            <div className="flex gap-2">
              <select
                className="field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t("item.category")}
              >
                <option value="">{t("category.none")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {/* Por si llega una que aún no está en la lista (polling a destiempo). */}
                {category && !categories.some((c) => c.name === category) && (
                  <option value={category}>{category}</option>
                )}
              </select>
              <button
                type="button"
                className="btn shrink-0"
                onClick={addCategory}
                aria-label={t("category.promptNew")}
              >
                +
              </button>
            </div>
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
                onDelete();
                close(null);
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
