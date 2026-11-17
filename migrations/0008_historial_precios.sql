-- Historial de precios: cada precio que se apunta (a mano o desde un ticket)
-- se guarda en vez de pisar el anterior. Así un artículo genérico como «肉»
-- (la carne que toque) puede enseñar la mediana de lo que se suele pagar, y
-- cualquier artículo deja ver cómo cambia su precio entre compras y tiendas.
--
-- Va por nombre del artículo (name_key, como price_memory), no por id: sobrevive
-- a «Borrar los comprados» y a volver a añadir el mismo artículo.
CREATE TABLE price_history (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name_key     TEXT NOT NULL,   -- artículo de la lista al que se asignó
  label        TEXT,            -- lo que ponía el ticket («豚こま切れ»), si viene de uno
  price        INTEGER NOT NULL,
  store_id     TEXT REFERENCES stores(id) ON DELETE SET NULL,
  at           INTEGER NOT NULL
);
CREATE INDEX idx_price_history ON price_history(household_id, name_key, at DESC);

-- Los precios recordados hasta ahora entran como primera entrada del historial.
INSERT INTO price_history (id, household_id, name_key, label, price, store_id, at)
SELECT lower(hex(randomblob(16))), pm.household_id, pm.name_key, NULL, pm.price,
       CASE WHEN pm.store_id = '' OR s.id IS NULL THEN NULL ELSE pm.store_id END,
       pm.updated_at
FROM price_memory pm LEFT JOIN stores s ON s.id = pm.store_id;
