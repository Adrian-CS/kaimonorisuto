-- Asociaciones de líneas de ticket ajustadas a mano: «豚こま» → 肉,
-- «スプライト» → añadir como artículo nuevo, «レジ袋» → no es de la lista.
-- La próxima vez que salga esa línea, la revisión ya viene con esa elección.
-- Son del hogar (las comparten los dos).
CREATE TABLE receipt_aliases (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label_key    TEXT NOT NULL,   -- la línea del ticket, normalizada
  kind         TEXT NOT NULL CHECK (kind IN ('item', 'new', 'skip')),
  target       TEXT,            -- nombre del artículo (kind = 'item')
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (household_id, label_key)
);
