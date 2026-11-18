import type { Currency } from "./money";

export type Store = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type Item = {
  id: string;
  name: string;
  qty: string | null;
  category: string | null;
  note: string | null;
  /** Tiendas donde se puede comprar; la primera es la principal. */
  store_ids: string[];
  photo_key: string | null;
  price: number | null;
  done: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

/** Algo que se ha comprado alguna vez (histórico, para «frecuentes»). */
export type Product = {
  id: string;
  name: string;
  qty: string | null;
  category: string | null;
  store_ids: string[];
  photo_key: string | null;
  times: number;
  last_at: number;
};

/** Un precio apuntado: a mano, o desde una línea de ticket (`label`). */
export type PriceEntry = {
  label: string | null;
  price: number;
  store_id: string | null;
  at: number;
};

/** Resumen del historial de un artículo: lo que se enseña en la lista. */
export type PriceStats = {
  median: number;
  min: number;
  max: number;
  n: number;
};

export type Me = {
  userId: string;
  userName: string;
  householdId: string;
  householdName: string;
  inviteCode: string;
  currency: Currency;
};

export type Snapshot = {
  me: Me;
  stores: Store[];
  categories: Category[];
  items: Item[];
  products?: Product[];
  /** Historial de precios por nombre de artículo (nameKey). */
  priceStats?: Record<string, PriceStats>;
  /** Cuándo se generó en el servidor (para compararlo con la copia local). */
  servedAt?: number;
  /** Versión del servidor que lo ha servido. */
  build?: string;
};
