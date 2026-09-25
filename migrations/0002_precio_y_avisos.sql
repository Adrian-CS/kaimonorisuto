-- Precio orientativo por artículo (en la unidad menor: yenes enteros, céntimos
-- de euro). Entero para no arrastrar errores de coma flotante.
ALTER TABLE items ADD COLUMN price INTEGER;

-- Moneda del hogar: "JPY" o "EUR".
ALTER TABLE households ADD COLUMN currency TEXT NOT NULL DEFAULT 'JPY';

-- Último precio visto de cada producto en cada tienda, para precargarlo la
-- próxima vez que se escriba ese mismo nombre. store_id vacío = sin tienda.
CREATE TABLE price_memory (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name_key     TEXT NOT NULL,
  store_id     TEXT NOT NULL DEFAULT '',
  price        INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (household_id, name_key, store_id)
);

-- Un registro por navegador/dispositivo suscrito a las notificaciones.
CREATE TABLE push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  lang       TEXT NOT NULL DEFAULT 'es',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
