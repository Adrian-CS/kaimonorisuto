/**
 * Cola de cambios pendientes, para poder usar la lista sin conexión.
 *
 * Cada cambio de la lista (marcar, añadir, editar, borrar…) se guarda aquí
 * antes de mandarse, en localStorage, así que sobrevive a cerrar la app. Se
 * mandan en orden, de uno en uno; si falla la red, la cola se para y se
 * reintenta al volver la conexión. La pantalla ya muestra el cambio desde el
 * principio (optimistic update), así que sin conexión todo se ve igual.
 *
 * Para que reintentar sea seguro, las peticiones son idempotentes: los
 * artículos, tiendas y categorías nuevos llevan un id generado aquí, y marcar
 * como comprado manda el estado final en vez de «alternar».
 */

export type Op = {
  /** Identifica la operación en la cola. */
  key: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  /** Reintentos tras errores 5xx; pasado el límite, se descarta. */
  tries?: number;
};

export type SendResult =
  | { status: "sent"; ok: boolean; code: number; data: Record<string, unknown> }
  | { status: "queued" };

const MAX_TRIES = 5;
const storageKey = (householdId: string) => `outbox:${householdId}`;

type Listener = () => void;

export class Outbox {
  private ops: Op[];
  private flushing = false;
  private waiters = new Map<string, (r: SendResult) => void>();
  private listeners = new Set<Listener>();
  /** true si el último intento de envío falló por la red. */
  offline = false;

  constructor(private householdId: string) {
    this.ops = read(storageKey(householdId));
  }

  get size() {
    return this.ops.length;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /**
   * Encola un cambio y trata de mandarlo. La promesa se resuelve cuando el
   * servidor responde, o con `queued` si no hay conexión (el cambio sigue en
   * la cola y saldrá más tarde).
   */
  send(op: Omit<Op, "key">): Promise<SendResult> {
    const full: Op = { ...op, key: crypto.randomUUID() };
    this.ops.push(full);
    this.save();
    const result = new Promise<SendResult>((resolve) =>
      this.waiters.set(full.key, resolve),
    );
    void this.flush();
    return result;
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.ops.length) {
        const op = this.ops[0];
        let res: Response;
        try {
          res = await fetch(op.url, {
            method: op.method,
            headers:
              op.body === undefined ? undefined : { "Content-Type": "application/json" },
            body: op.body === undefined ? undefined : JSON.stringify(op.body),
          });
        } catch {
          // Sin red: se queda todo en la cola. Quien esperaba, se entera.
          this.setOffline(true);
          for (const pending of this.ops) this.settle(pending.key, { status: "queued" });
          return;
        }
        this.setOffline(false);

        // Sesión caducada: no se tira nada; saldrá al volver a entrar.
        if (res.status === 401) {
          for (const pending of this.ops) this.settle(pending.key, { status: "queued" });
          return;
        }
        // Error del servidor: se reintenta un número limitado de veces para
        // que un cambio roto no bloquee la cola para siempre.
        if (res.status >= 500 && (op.tries ?? 0) + 1 < MAX_TRIES) {
          op.tries = (op.tries ?? 0) + 1;
          this.save();
          this.settle(op.key, { status: "queued" });
          return;
        }

        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        this.ops.shift();
        // Al crear algo que ya existía (p. ej. una tienda con el mismo
        // nombre), el servidor devuelve su id: los cambios que esperan en la
        // cola con el id provisional pasan a usar el bueno.
        const sentId = (op.body as { id?: unknown } | undefined)?.id;
        if (op.method === "POST" && typeof sentId === "string" && typeof data.id === "string" && data.id !== sentId)
          this.remap(sentId, data.id);
        this.save();
        this.settle(op.key, { status: "sent", ok: res.ok, code: res.status, data });
      }
    } finally {
      this.flushing = false;
      this.emit();
    }
  }

  /** Vacía la cola (al cerrar sesión). */
  clear() {
    this.ops = [];
    this.save();
  }

  private remap(from: string, to: string) {
    this.ops = this.ops.map((op) => JSON.parse(JSON.stringify(op).replaceAll(from, to)));
  }

  private settle(key: string, r: SendResult) {
    const fn = this.waiters.get(key);
    if (!fn) return;
    this.waiters.delete(key);
    fn(r);
  }

  private setOffline(v: boolean) {
    if (this.offline === v) return;
    this.offline = v;
    this.emit();
  }

  private save() {
    try {
      localStorage.setItem(storageKey(this.householdId), JSON.stringify(this.ops));
    } catch {
      /* sin almacenamiento: la cola vive solo en memoria */
    }
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

function read(key: string): Op[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Op[]) : [];
  } catch {
    return [];
  }
}

/* ---------- copia local de la lista ---------- */

const snapshotKey = "snapshot:v1";

export type Cached<T> = { householdId: string; at: number; data: T };

export function loadSnapshot<T>(householdId: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(snapshotKey);
    const c = raw ? (JSON.parse(raw) as Cached<T>) : null;
    return c && c.householdId === householdId ? c : null;
  } catch {
    return null;
  }
}

export function saveSnapshot<T>(householdId: string, data: T) {
  try {
    localStorage.setItem(
      snapshotKey,
      JSON.stringify({ householdId, at: Date.now(), data } satisfies Cached<T>),
    );
  } catch {
    /* lleno o en modo privado: sin copia local */
  }
}

/** Al cerrar sesión: fuera la copia local, la cola y la caché del service worker. */
export async function forgetLocalData() {
  try {
    for (const k of Object.keys(localStorage))
      if (k === snapshotKey || k.startsWith("outbox:")) localStorage.removeItem(k);
  } catch {
    /* nada que borrar */
  }
  try {
    if ("caches" in window)
      for (const name of await caches.keys())
        if (name.startsWith("lista-")) await caches.delete(name);
  } catch {
    /* sin Cache API */
  }
}
