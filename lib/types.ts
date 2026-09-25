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
  store_id: string | null;
  photo_key: string | null;
  price: number | null;
  done: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
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
};
