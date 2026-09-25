-- Categorías como lista propia del hogar, igual que los supermercados: se
-- crean una vez y luego se eligen, en vez de escribirlas en cada artículo.
-- Los artículos siguen guardando el nombre en items.category, así que no hay
-- que tocar los datos existentes; renombrar o borrar una categoría actualiza
-- esos artículos desde la API.
CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_categories_household ON categories(household_id, sort_order);

-- Las categorías que ya estaban escritas a mano pasan a la lista, por orden
-- alfabético. Una por nombre (sin distinguir mayúsculas).
INSERT INTO categories (id, household_id, name, sort_order, created_at)
SELECT lower(hex(randomblob(16))), household_id, name,
       ROW_NUMBER() OVER (PARTITION BY household_id ORDER BY name COLLATE NOCASE),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
  SELECT household_id, MIN(category) AS name
  FROM items
  WHERE category IS NOT NULL AND trim(category) <> ''
  GROUP BY household_id, lower(category)
);

-- Y los artículos pasan a usar ese nombre exacto, para que «leche» y «Leche»
-- no salgan como dos grupos distintos.
UPDATE items SET category = NULL
WHERE category IS NOT NULL AND trim(category) = '';

UPDATE items SET category = (
  SELECT c.name FROM categories c
  WHERE c.household_id = items.household_id AND lower(c.name) = lower(items.category)
)
WHERE category IS NOT NULL;
