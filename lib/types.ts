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
  /** Cuándo se generó en el servidor (para compararlo con la copia local). */
  servedAt?: number;
};
