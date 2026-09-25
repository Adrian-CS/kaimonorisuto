"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ItemSheet, { type ItemPatch } from "./ItemSheet";
import { useI18n } from "./I18n";
import MenuSheet from "./MenuSheet";
import { formatMoney, type Currency } from "@/lib/money";
import { errorText, type Key } from "@/lib/i18n";
import type { Category, Item, Snapshot, Store } from "@/lib/types";

type GroupBy = "store" | "category" | "none";

const SIN_SUPER = "__sin_super__";
const SIN_CATEGORIA = "__sin_categoria__";
const NUEVA = "__nueva__";

/** Intercambia una fila con su vecina y renumera el orden desde 1. */
function swapOrder<T extends { id: string; sort_order: number }>(
  list: T[],
  id: string,
  dir: -1 | 1,
): T[] | null {
  const idx = list.findIndex((s) => s.id === id);
  const other = idx + dir;
  if (idx < 0 || other < 0 || other >= list.length) return null;
  const next = [...list];
  [next[idx], next[other]] = [next[other], next[idx]];
  return next.map((s, i) => ({ ...s, sort_order: i + 1 }));
}

/** Bandas verticales medidas al empezar a arrastrar. */
type Band = {
  kind: "header" | "item";
  id: string; // id del artículo, o clave del grupo si es cabecera
  groupKey: string;
  top: number;
  bottom: number;
};

export default function ListView({ initial }: { initial: Snapshot }) {
  const { t, lang } = useI18n();
  const [me, setMe] = useState(initial.me);
  const [stores, setStores] = useState<Store[]>(initial.stores);
  const [categories, setCategories] = useState<Category[]>(
    initial.categories ?? [],
  );
  const [items, setItems] = useState<Item[]>(initial.items);

  const [groupBy, setGroupBy] = useState<GroupBy>("store");
  const [showDone, setShowDone] = useState(true);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [notifyNext, setNotifyNext] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Modo selección: tocar marca filas en vez de tacharlas, y abajo aparece
  // una barra para cambiarles la categoría o la tienda a todas de golpe.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const dirty = useRef(0); // evita que el polling pise cambios recién hechos
  const headerRef = useRef<HTMLElement>(null);

  /* ---------- arrastre ---------- */

  const rowRefs = useRef(new Map<string, HTMLElement>());
  const bands = useRef<Band[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dropAt, setDropAt] = useState<{ index: number; groupKey: string } | null>(
    null,
  );

  // La cabecera cambia de alto (buscador, chips en dos líneas): medimos su
  // altura real para que los títulos de grupo se peguen justo debajo.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.offsetHeight}px`,
      );
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- preferencias locales ---------- */

  useEffect(() => {
    try {
      const g = localStorage.getItem("groupBy") as GroupBy | null;
      if (g) setGroupBy(g);
      const d = localStorage.getItem("showDone");
      if (d !== null) setShowDone(d === "1");
    } catch {
      /* modo privado: da igual */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("groupBy", groupBy);
      localStorage.setItem("showDone", showDone ? "1" : "0");
    } catch {
      /* ignorar */
    }
  }, [groupBy, showDone]);

  /* ---------- sincronización ---------- */

  const refresh = useCallback(async () => {
    if (Date.now() - dirty.current < 1500) return;
    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Snapshot;
      if (Date.now() - dirty.current < 1500) return;
      setMe(data.me);
      setStores(data.stores);
      setCategories(data.categories ?? []);
      setItems(data.items);
    } catch {
      /* sin conexión: se reintenta al siguiente tick */
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !dragId) void refresh();
    };
    const id = setInterval(tick, 8000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh, dragId]);

  /* ---------- acciones ---------- */

  const touch = () => {
    dirty.current = Date.now();
  };

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const notify = notifyNext;
    setDraft("");
    setNotifyNext(false); // la campana es de un solo uso
    touch();

    const temp: Item = {
      id: `temp-${crypto.randomUUID()}`,
      name,
      qty: null,
      category: null,
      note: null,
      store_id: null,
      photo_key: null,
      price: null,
      done: 0,
      sort_order: Math.min(0, ...items.map((i) => i.sort_order)) - 1,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setItems((prev) => [temp, ...prev]);

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, notify }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      price?: number | null;
    };
    touch();
    setItems((prev) =>
      data.id
        ? prev.map((i) =>
            i.id === temp.id
              ? { ...i, id: data.id!, price: data.price ?? null }
              : i,
          )
        : prev.filter((i) => i.id !== temp.id),
    );
  }

  /**
   * Avisa a los demás de un artículo que ya está en la lista. Con `toggle`,
   * además lo marca o desmarca, y el aviso describe el estado resultante.
   */
  async function notifyAbout(id: string, toggle = false) {
    try {
      const res = await fetch(`/api/items/${id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        reason?: string;
        done?: number;
      };
      return {
        sent: res.ok ? (data.sent ?? 0) : 0,
        reason: res.ok ? data.reason : "failed",
        done: data.done,
      };
    } catch {
      return { sent: 0, reason: "failed", done: undefined };
    }
  }

  /* ---------- mantener pulsado para marcar y avisar ---------- */

  // Cruzado el umbral, el aviso sale al soltar, no antes: así un roce
  // accidental se puede abortar apartando el dedo.
  const HOLD_MS = 500;
  const HOLD_SLOP = 10; // píxeles de margen antes de dar el gesto por scroll

  const hold = useRef<{
    id: string;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  // Cuando se arma, el click de soltar ya no debe hacer el toggle normal.
  const swallowClick = useRef(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; key: Key } | null>(null);

  const cancelHold = useCallback(() => {
    if (hold.current?.timer) clearTimeout(hold.current.timer);
    hold.current = null;
    setArmed(null);
  }, []);

  function holdStart(e: React.PointerEvent, id: string) {
    // Solo el botón principal; el asa de arrastre tiene su propio gesto.
    if (e.button !== 0) return;
    cancelHold();
    const timer = setTimeout(() => {
      setArmed(id);
      navigator.vibrate?.(15); // iOS no lo soporta: el indicador no es opcional
    }, HOLD_MS);
    hold.current = { id, x: e.clientX, y: e.clientY, timer };
  }

  function holdMove(e: React.PointerEvent) {
    const h = hold.current;
    if (!h) return;
    if (Math.hypot(e.clientX - h.x, e.clientY - h.y) <= HOLD_SLOP) return;
    // Apartar el dedo cancela el gesto entero, no solo el aviso: si ya estaba
    // armado, el click de soltar tampoco debe marcar el artículo.
    if (armed === h.id) swallowClick.current = true;
    cancelHold();
  }

  async function holdEnd(id: string) {
    const wasArmed = armed === id;
    cancelHold();
    if (!wasArmed) return;

    swallowClick.current = true;
    // El estado cambia igual; el aviso es el extra.
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, done: i.done ? 0 : 1 } : i)),
    );
    touch();

    const { sent, reason, done } = await notifyAbout(id, true);
    touch();
    if (typeof done === "number")
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done } : i)));

    setFlash({
      id,
      key:
        sent > 0
          ? "list.notified"
          : reason === "too_soon"
            ? "item.notifyTooSoon"
            : reason === "no_devices"
              ? "item.notifyNoOthers"
              : "item.notifyFailed",
    });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 3000);
  }

  async function patchItem(id: string, patch: ItemPatch | { done: number }) {
    touch();
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch, updated_at: Date.now() } : i)),
    );
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    touch();
  }

  async function deleteItem(id: string) {
    touch();
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    touch();
  }

  async function clearDone() {
    touch();
    setItems((prev) => prev.filter((i) => !i.done));
    await fetch("/api/items", { method: "DELETE" });
    touch();
  }

  async function setCurrency(currency: Currency) {
    touch();
    setMe((prev) => ({ ...prev, currency }));
    await fetch("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    touch();
  }

  async function createStore(name: string) {
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const { id } = (await res.json()) as { id: string };
    setStores((prev) =>
      prev.some((s) => s.id === id)
        ? prev
        : [...prev, { id, name, color: null, sort_order: prev.length + 1 }],
    );
    return id;
  }

  async function renameStore(id: string, name: string) {
    setStores((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteStore(id: string) {
    touch();
    setStores((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) =>
      prev.map((i) => (i.store_id === id ? { ...i, store_id: null } : i)),
    );
    await fetch(`/api/stores/${id}`, { method: "DELETE" });
    touch();
  }

  async function moveStore(id: string, dir: -1 | 1) {
    const renumbered = swapOrder(stores, id, dir);
    if (!renumbered) return;
    setStores(renumbered);
    await Promise.all(
      renumbered.map((s) =>
        fetch(`/api/stores/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: s.sort_order }),
        }),
      ),
    );
  }

  /** Crea (o reutiliza) una categoría y devuelve su nombre tal cual se guardó. */
  async function createCategory(name: string) {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as { id: string; name: string };
    setCategories((prev) =>
      prev.some((c) => c.id === saved.id)
        ? prev
        : [...prev, { ...saved, sort_order: prev.length + 1 }],
    );
    return saved.name;
  }

  async function renameCategory(id: string, name: string) {
    const old = categories.find((c) => c.id === id)?.name;
    if (!old) return;
    touch();
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setItems((prev) =>
      prev.map((i) => (i.category === old ? { ...i, category: name } : i)),
    );
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(errorText(t, data.error));
      dirty.current = 0;
      void refresh();
      return;
    }
    touch();
  }

  async function deleteCategory(id: string) {
    const old = categories.find((c) => c.id === id)?.name;
    touch();
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) =>
      prev.map((i) => (i.category === old ? { ...i, category: null } : i)),
    );
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    touch();
  }

  async function moveCategory(id: string, dir: -1 | 1) {
    const renumbered = swapOrder(categories, id, dir);
    if (!renumbered) return;
    setCategories(renumbered);
    await Promise.all(
      renumbered.map((c) =>
        fetch(`/api/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: c.sort_order }),
        }),
      ),
    );
  }

  /* ---------- selección y cambios en bloque ---------- */

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setBulkMsg(null);
  }

  function toggleSelected(ids: string[]) {
    setBulkMsg(null);
    setSelected((prev) => {
      const next = new Set(prev);
      // Si ya estaban todos, se quitan; si no, se añaden los que falten.
      const all = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function bulkPatch(patch: { category?: string | null; store_id?: string | null }) {
    const ids = [...selected].filter((id) => !id.startsWith("temp-"));
    if (!ids.length) return;
    touch();
    setItems((prev) =>
      prev.map((i) =>
        selected.has(i.id) ? { ...i, ...patch, updated_at: Date.now() } : i,
      ),
    );
    setBulkMsg(t("select.applied", { n: ids.length }));
    await fetch("/api/items/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, ...patch }),
    });
    touch();
  }

  async function bulkCategory(value: string) {
    if (value === NUEVA) {
      const n = window.prompt(t("category.promptNew"));
      if (!n?.trim()) return;
      const saved = await createCategory(n.trim());
      if (saved) await bulkPatch({ category: saved });
      return;
    }
    await bulkPatch({ category: value === SIN_CATEGORIA ? null : value });
  }

  async function bulkStore(value: string) {
    if (value === NUEVA) {
      const n = window.prompt(t("store.promptNew"));
      if (!n?.trim()) return;
      const id = await createStore(n.trim());
      if (id) await bulkPatch({ store_id: id });
      return;
    }
    await bulkPatch({ store_id: value === SIN_SUPER ? null : value });
  }

  /* ---------- derivados ---------- */

  const categoryNames = useMemo(
    () => categories.map((c) => c.name),
    [categories],
  );

  const storeName = useCallback(
    (id: string | null) => stores.find((s) => s.id === id)?.name ?? SIN_SUPER,
    [stores],
  );

  // Los grupos "sin tienda" / "sin categoría" se guardan con una clave interna
  // para que no dependan del idioma, y se traducen solo al pintarlos.
  const groupLabel = useCallback(
    (label: string) =>
      label === SIN_SUPER
        ? t("store.none")
        : label === SIN_CATEGORIA
          ? t("category.none")
          : label,
    [t],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => {
        if (!showDone && i.done) return false;
        if (!q) return true;
        return (
          i.name.toLowerCase().includes(q) ||
          (i.note ?? "").toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          a.done - b.done ||
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, lang),
      );
  }, [items, showDone, query, lang]);

  const groups = useMemo(() => {
    if (groupBy === "none")
      return [{ key: "__todo__", label: "", items: visible }];

    const buckets = new Map<string, Item[]>();
    // Los grupos vacíos también se pintan: así se puede arrastrar un artículo
    // a una tienda o categoría que aún no tiene nada.
    if (groupBy === "store") {
      for (const s of stores) buckets.set(s.name, []);
      buckets.set(SIN_SUPER, []);
    } else {
      for (const c of categoryNames) buckets.set(c, []);
      buckets.set(SIN_CATEGORIA, []);
    }

    for (const it of visible) {
      const label =
        groupBy === "store" ? storeName(it.store_id) : (it.category ?? SIN_CATEGORIA);
      const list = buckets.get(label);
      if (list) list.push(it);
      else buckets.set(label, [it]);
    }

    const order =
      groupBy === "store"
        ? [...stores.map((s) => s.name), SIN_SUPER]
        : [...categoryNames, SIN_CATEGORIA];

    return [...buckets.entries()]
      .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
      .map(([label, list]) => ({ key: label, label, items: list }));
  }, [visible, groupBy, stores, categoryNames, storeName]);

  const pending = items.filter((i) => !i.done).length;
  const doneCount = items.length - pending;

  const anyPrice = items.some((i) => i.price !== null);
  const sumPending = (list: Item[]) =>
    list.reduce((n, i) => (i.done ? n : n + (i.price ?? 0)), 0);
  const total = sumPending(items);

  const storeIdByLabel = useCallback(
    (label: string) =>
      label === SIN_SUPER ? null : (stores.find((s) => s.name === label)?.id ?? null),
    [stores],
  );

  /* ---------- arrastrar y soltar ---------- */

  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Medimos una sola vez: la lista no se reordena hasta soltar, así que
    // estas bandas siguen siendo válidas durante todo el gesto.
    const measured: Band[] = [];
    for (const g of groups) {
      const head = rowRefs.current.get(`head:${g.key}`);
      if (head) {
        const r = head.getBoundingClientRect();
        measured.push({
          kind: "header",
          id: g.key,
          groupKey: g.key,
          top: r.top,
          bottom: r.bottom,
        });
      }
      for (const it of g.items) {
        const el = rowRefs.current.get(it.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        measured.push({
          kind: "item",
          id: it.id,
          groupKey: g.key,
          top: r.top,
          bottom: r.bottom,
        });
      }
    }
    bands.current = measured;
    setDragId(id);
    setDragY(e.clientY);
    setDropAt(null);
  }

  function moveDrag(e: React.PointerEvent) {
    if (!dragId) return;
    e.preventDefault();
    const y = e.clientY;
    setDragY(y);

    const flat = visibleFlat();
    let index = flat.length;
    let groupKey = groups[groups.length - 1]?.key ?? "";

    for (const band of bands.current) {
      if (y < (band.top + band.bottom) / 2) {
        if (band.kind === "header") {
          index = flat.findIndex((f) => f.groupKey === band.groupKey);
          if (index < 0) index = flat.length;
          groupKey = band.groupKey;
        } else {
          index = flat.findIndex((f) => f.id === band.id);
          groupKey = band.groupKey;
        }
        break;
      }
      if (band.kind === "item") {
        index = flat.findIndex((f) => f.id === band.id) + 1;
        groupKey = band.groupKey;
      } else {
        groupKey = band.groupKey;
      }
    }

    setDropAt({ index, groupKey });
  }

  function visibleFlat() {
    return groups.flatMap((g) =>
      g.items.map((it) => ({ id: it.id, groupKey: g.key })),
    );
  }

  async function endDrag() {
    const id = dragId;
    const target = dropAt;
    setDragId(null);
    setDropAt(null);
    bands.current = [];
    if (!id || !target) return;

    const flat = visibleFlat().map((f) => f.id);
    const from = flat.indexOf(id);
    if (from < 0) return;

    const without = flat.filter((x) => x !== id);
    const to = target.index > from ? target.index - 1 : target.index;
    without.splice(Math.max(0, Math.min(to, without.length)), 0, id);

    const newStoreId =
      groupBy === "store" ? storeIdByLabel(target.groupKey) : undefined;
    const newCategory =
      groupBy === "category"
        ? target.groupKey === SIN_CATEGORIA
          ? null
          : target.groupKey
        : undefined;

    const orderOf = new Map(without.map((x, i) => [x, i]));
    touch();
    setItems((prev) =>
      prev.map((it) => {
        if (!orderOf.has(it.id)) return it;
        const next = { ...it, sort_order: orderOf.get(it.id)! };
        if (it.id === id && newStoreId !== undefined) next.store_id = newStoreId;
        if (it.id === id && newCategory !== undefined) next.category = newCategory;
        return next;
      }),
    );

    await fetch("/api/items/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moves: without.map((x, i) =>
          x !== id
            ? { id: x, sort_order: i }
            : {
                id: x,
                sort_order: i,
                ...(newStoreId !== undefined && { store_id: newStoreId }),
                ...(newCategory !== undefined && { category: newCategory }),
              },
        ),
      }),
    });
    touch();
  }

  const draggedItem = dragId ? items.find((i) => i.id === dragId) : null;

  /* ---------- render ---------- */

  const setRowRef = (key: string) => (el: HTMLElement | null) => {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  };

  const dropIndicator = (index: number) =>
    dropAt?.index === index ? (
      <div className="pointer-events-none -mb-px h-0.5 bg-accent" />
    ) : null;

  let flatIndex = 0;

  return (
    <main
      className={`mx-auto min-h-dvh w-full max-w-xl ${selecting ? "pb-48" : "pb-24"}`}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={dragId ? { touchAction: "none", userSelect: "none" } : undefined}
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">
              🥕 {me.householdName}
            </h1>
            <p className="text-xs text-muted">
              {t("list.counts", { pending, total: items.length })}
              {anyPrice && total > 0 && (
                <>
                  {" · "}
                  {t("list.total", {
                    amount: formatMoney(total, me.currency, lang),
                  })}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("settings.title")}
            className="rounded-full border border-border px-3 py-1.5 text-muted"
          >
            ⋯
          </button>
        </div>

        <form onSubmit={addItem} className="mt-3 flex gap-2">
          <input
            className="field"
            placeholder={t("list.add")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            enterKeyHint="done"
          />
          <button
            type="button"
            onClick={() => setNotifyNext((v) => !v)}
            aria-pressed={notifyNext}
            aria-label={notifyNext ? t("bell.on") : t("bell.off")}
            title={notifyNext ? t("bell.on") : t("bell.off")}
            className={`shrink-0 rounded-[0.625rem] border px-3 text-lg transition ${
              notifyNext
                ? "border-accent bg-accent/15"
                : "border-border opacity-35 grayscale"
            }`}
          >
            🔔
          </button>
          <button className="btn btn-primary shrink-0" aria-label={t("list.addAria")}>
            +
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ["store", t("group.store")],
              ["category", t("group.category")],
              ["none", t("group.none")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGroupBy(id)}
              className={`shrink-0 rounded-full border px-3 py-1 ${
                groupBy === id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            aria-pressed={selecting}
            className={`ml-auto shrink-0 rounded-full border px-3 py-1 ${
              selecting
                ? "border-accent bg-accent/15 text-accent"
                : "border-border text-muted"
            }`}
          >
            {selecting ? t("select.done") : t("select.start")}
          </button>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1 ${
              showDone ? "border-border text-muted" : "border-accent text-accent"
            }`}
          >
            {showDone ? t("list.hideDone") : t("list.onlyPending")}
          </button>
        </div>

        {items.length > 12 && (
          <input
            className="field mt-2"
            placeholder={t("list.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
          />
        )}
      </header>

      {visible.length === 0 && (
        <p className="px-4 py-16 text-center text-sm text-muted">
          {t("list.empty")}
        </p>
      )}

      {groups.map((g) => {
        const groupTotal = sumPending(g.items);
        return (
          <section key={g.key}>
            {g.label && (
              <h2
                ref={setRowRef(`head:${g.key}`)}
                className={`sticky top-[var(--header-h,9rem)] z-10 flex items-center gap-2 bg-surface-2 px-4 py-1.5 text-xs font-medium tracking-wide text-muted uppercase ${
                  g.items.length === 0 ? "opacity-40" : ""
                }`}
              >
                {selecting && g.items.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleSelected(g.items.map((i) => i.id))}
                    aria-label={t("select.group", { name: groupLabel(g.label) })}
                    className="flex min-w-0 items-center gap-2 uppercase"
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                        g.items.every((i) => selected.has(i.id))
                          ? "border-accent bg-accent text-[#05121f]"
                          : "border-border"
                      }`}
                    >
                      {g.items.every((i) => selected.has(i.id)) ? "✓" : ""}
                    </span>
                    <span className="truncate">{groupLabel(g.label)}</span>
                  </button>
                ) : (
                  <span className="truncate">{groupLabel(g.label)}</span>
                )}
                {g.items.length > 0 && (
                  <span className="normal-case opacity-60">
                    {g.items.filter((i) => !i.done).length}/{g.items.length}
                  </span>
                )}
                {anyPrice && groupTotal > 0 && (
                  <span className="ml-auto normal-case opacity-60">
                    {t("list.groupTotal", {
                      amount: formatMoney(groupTotal, me.currency, lang),
                    })}
                  </span>
                )}
              </h2>
            )}
            <ul>
              {g.items.map((it) => {
                const myIndex = flatIndex++;
                return (
                  <li
                    key={it.id}
                    ref={setRowRef(it.id)}
                    className={`border-b border-border/70 transition-colors ${
                      dragId === it.id ? "opacity-30" : ""
                    } ${armed === it.id || (selecting && selected.has(it.id)) ? "bg-accent/10" : ""}`}
                  >
                    {dropIndicator(myIndex)}
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (selecting) {
                            toggleSelected([it.id]);
                            return;
                          }
                          // Tras un gesto armado, el toggle ya lo hizo holdEnd.
                          if (swallowClick.current) {
                            swallowClick.current = false;
                            return;
                          }
                          patchItem(it.id, { done: it.done ? 0 : 1 });
                        }}
                        onPointerDown={(e) => !selecting && holdStart(e, it.id)}
                        onPointerMove={holdMove}
                        onPointerUp={() => !selecting && void holdEnd(it.id)}
                        onPointerCancel={cancelHold}
                        // Safari abre el menú de selección al mantener pulsado.
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={
                          selecting ? t("select.toggle", { name: it.name }) : undefined
                        }
                        aria-pressed={selecting ? selected.has(it.id) : undefined}
                        className="flex min-w-0 flex-1 touch-pan-y items-center gap-3 text-left select-none [-webkit-touch-callout:none]"
                      >
                        {selecting ? (
                          // Casilla cuadrada para que no se confunda con «comprado».
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                              selected.has(it.id)
                                ? "border-accent bg-accent text-[#05121f]"
                                : "border-border"
                            }`}
                          >
                            {selected.has(it.id) ? "✓" : ""}
                          </span>
                        ) : (
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                              it.done
                                ? "border-accent bg-accent text-[#05121f]"
                                : "border-border"
                            }`}
                          >
                            {it.done ? "✓" : ""}
                          </span>
                        )}

                        {it.photo_key && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/photos/${it.photo_key}`}
                            alt=""
                            loading="lazy"
                            className={`h-9 w-9 shrink-0 rounded-md object-cover ${
                              it.done ? "opacity-40" : ""
                            }`}
                          />
                        )}

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${
                              it.done ? "text-muted line-through" : ""
                            }`}
                          >
                            {it.name}
                            {it.qty && (
                              <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 align-middle text-xs text-muted">
                                {it.qty}
                              </span>
                            )}
                          </span>
                          {armed === it.id ? (
                            <span className="block truncate text-xs text-accent">
                              {t("list.releaseToNotify")}
                            </span>
                          ) : flash?.id === it.id ? (
                            <span className="block truncate text-xs text-accent">
                              {t(flash.key)}
                            </span>
                          ) : (
                            it.note && (
                              <span className="block truncate text-xs text-muted">
                                {it.note}
                              </span>
                            )
                          )}
                        </span>

                        {it.price !== null && (
                          <span
                            className={`shrink-0 text-xs tabular-nums ${
                              it.done ? "text-muted/50" : "text-muted"
                            }`}
                          >
                            {formatMoney(it.price, me.currency, lang)}
                          </span>
                        )}
                      </button>

                      {!selecting && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(it)}
                            aria-label={t("item.editAria", { name: it.name })}
                            className="shrink-0 px-1.5 py-1 text-accent"
                          >
                            ✎
                          </button>

                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={t("drag.handle", { name: it.name })}
                            onPointerDown={(e) => startDrag(e, it.id)}
                            className="shrink-0 cursor-grab touch-none px-1 py-1 text-lg leading-none text-muted select-none"
                          >
                            ⠿
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {dropAt?.groupKey === g.key && dropIndicator(flatIndex)}
          </section>
        );
      })}

      {draggedItem && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 w-[min(28rem,90vw)] -translate-x-1/2 rounded-lg border border-accent bg-surface px-4 py-2.5 shadow-lg"
          style={{ top: dragY - 20 }}
        >
          <span className="truncate text-sm">{draggedItem.name}</span>
        </div>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">
                {bulkMsg ?? t("select.count", { n: selected.size })}
              </span>
              <button
                type="button"
                className="text-accent"
                onClick={() => {
                  setBulkMsg(null);
                  setSelected(
                    selected.size === visible.length
                      ? new Set()
                      : new Set(visible.map((i) => i.id)),
                  );
                }}
              >
                {selected.size === visible.length && visible.length > 0
                  ? t("select.none")
                  : t("select.all")}
              </button>
            </div>
            <div className="flex gap-2">
              {/* value fijo en "": el select vuelve a su rótulo tras cada cambio. */}
              <select
                className="field"
                value=""
                disabled={selected.size === 0}
                aria-label={t("select.setCategory")}
                onChange={(e) => void bulkCategory(e.target.value)}
              >
                <option value="" disabled>
                  {t("select.setCategory")}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value={SIN_CATEGORIA}>{t("category.none")}</option>
                <option value={NUEVA}>{t("category.new")}</option>
              </select>
              <select
                className="field"
                value=""
                disabled={selected.size === 0}
                aria-label={t("select.setStore")}
                onChange={(e) => void bulkStore(e.target.value)}
              >
                <option value="" disabled>
                  {t("select.setStore")}
                </option>
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
                <option value={SIN_SUPER}>{t("store.none")}</option>
                <option value={NUEVA}>{t("store.new")}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ItemSheet
          item={items.find((i) => i.id === editing.id) ?? editing}
          stores={stores}
          categories={categories}
          currency={me.currency}
          onClose={() => setEditing(null)}
          onSave={(patch) => patchItem(editing.id, patch)}
          onDelete={() => deleteItem(editing.id)}
          onCreateStore={createStore}
          onCreateCategory={createCategory}
          onNotify={() => notifyAbout(editing.id)}
        />
      )}

      {menuOpen && (
        <MenuSheet
          me={me}
          stores={stores}
          categories={categories}
          doneCount={doneCount}
          onClose={() => setMenuOpen(false)}
          onCreateStore={createStore}
          onRenameStore={renameStore}
          onDeleteStore={deleteStore}
          onMoveStore={moveStore}
          onCreateCategory={createCategory}
          onRenameCategory={renameCategory}
          onDeleteCategory={deleteCategory}
          onMoveCategory={moveCategory}
          onClearDone={clearDone}
          onSetCurrency={setCurrency}
        />
      )}
    </main>
  );
}
