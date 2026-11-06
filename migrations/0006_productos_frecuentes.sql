-- Histórico de productos: lo que se ha comprado alguna vez, con los últimos
-- datos que tenía (foto, tienda, categoría, cantidad). Sirve para sugerirlo al
-- escribir y para la lista de «lo de siempre», sin rellenar nada otra vez.
-- Sobrevive a «Borrar los comprados»: el artículo desaparece de la lista,
-- pero el producto se queda aquí.
CREATE TABLE products (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name_key     TEXT NOT NULL,   -- nombre en minúsculas, para no duplicar
  name         TEXT NOT NULL,
  qty          TEXT,
  category     TEXT,            -- nombre, como en items
  store_id     TEXT REFERENCES stores(id) ON DELETE SET NULL,
  photo_key    TEXT,
  times        INTEGER NOT NULL DEFAULT 0,  -- cuántas veces se ha comprado
  last_at      INTEGER NOT NULL,            -- última vez que se compró
  UNIQUE (household_id, name_key)
);
CREATE INDEX idx_products_household ON products(household_id, times DESC, last_at DESC);

-- Lo que ya está en la lista entra en el histórico (lo comprado cuenta como
-- una compra). Si hay dos artículos con el mismo nombre, se queda el último.
INSERT INTO products (id, household_id, name_key, name, qty, category, store_id, photo_key, times, last_at)
SELECT lower(hex(randomblob(16))), household_id, lower(trim(name)), trim(name),
       qty, category, store_id, photo_key, done, updated_at
FROM items
WHERE trim(name) <> ''
ORDER BY updated_at
ON CONFLICT (household_id, name_key) DO UPDATE SET
  name = excluded.name, qty = excluded.qty, category = excluded.category,
  store_id = excluded.store_id, photo_key = excluded.photo_key,
  times = products.times + excluded.times, last_at = excluded.last_at;
