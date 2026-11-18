-- Corrección de una vez: al pegar el ticket de 西友 del 14 de noviembre, la
-- チョコプリン y la キャラメルプリン se asignaron a «プリン». Se separan:
-- - チョコプリン → el artículo de pudin de chocolate que ya existe;
-- - キャラメルプリン → un artículo nuevo «キャラメルプリン», ya comprado.
-- Con sus precios, su tienda, «lo de siempre» y lo aprendido en «Pegar
-- precios», para que el próximo ticket ya vaya a cada uno.
-- Solo actúa en hogares con esas líneas de ticket en «プリン».

-- Los ids nuevos tienen forma de UUID, como los que crea la app.

-- 1. キャラメルプリン: artículo nuevo, comprado, con el precio y la tienda del ticket.
INSERT INTO items (id, household_id, name, category, store_ids, price, done, sort_order, created_at, updated_at)
SELECT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))), 2) || '-' ||
        substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
        lower(hex(randomblob(6)))), ph.household_id, 'キャラメルプリン',
       (SELECT category FROM items p WHERE p.household_id = ph.household_id AND lower(trim(p.name)) = 'プリン' LIMIT 1),
       CASE WHEN ph.store_id IS NULL THEN '[]' ELSE json_array(ph.store_id) END,
       ph.price, 1, 0, ph.at, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM price_history ph
WHERE ph.name_key = 'プリン' AND ph.label = 'キャラメルプリン'
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.household_id = ph.household_id AND lower(trim(i.name)) = 'キャラメルプリン'
  )
GROUP BY ph.household_id;

INSERT INTO products (id, household_id, name_key, name, category, store_ids, times, last_at)
SELECT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))), 2) || '-' ||
        substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
        lower(hex(randomblob(6)))), i.household_id, 'キャラメルプリン', 'キャラメルプリン',
       i.category, i.store_ids, 1, i.created_at
FROM items i
WHERE lower(trim(i.name)) = 'キャラメルプリン'
  AND EXISTS (
    SELECT 1 FROM price_history ph
    WHERE ph.household_id = i.household_id AND ph.name_key = 'プリン' AND ph.label = 'キャラメルプリン'
  )
ON CONFLICT (household_id, name_key) DO NOTHING;

UPDATE price_history SET name_key = 'キャラメルプリン'
WHERE name_key = 'プリン' AND label = 'キャラメルプリン';

-- 2. チョコプリン: al artículo de pudin de chocolate (en la lista, o si no, en
-- «lo de siempre»).
CREATE TABLE _choco AS
SELECT h.household_id, COALESCE(
  (SELECT lower(trim(i.name)) FROM items i
   WHERE i.household_id = h.household_id AND i.name LIKE '%チョコ%プリン%'
   ORDER BY i.updated_at DESC LIMIT 1),
  (SELECT p.name_key FROM products p
   WHERE p.household_id = h.household_id AND p.name LIKE '%チョコ%プリン%'
   ORDER BY p.last_at DESC LIMIT 1)
) AS name_key
FROM (SELECT DISTINCT household_id FROM price_history
      WHERE name_key = 'プリン' AND label = 'チョコプリン') h;
DELETE FROM _choco WHERE name_key IS NULL;

UPDATE price_history
SET name_key = (SELECT c.name_key FROM _choco c WHERE c.household_id = price_history.household_id)
WHERE name_key = 'プリン' AND label = 'チョコプリン'
  AND household_id IN (SELECT household_id FROM _choco);

-- Su precio y la tienda del ticket.
UPDATE items SET
  price = (SELECT ph.price FROM price_history ph JOIN _choco c ON c.household_id = ph.household_id
           WHERE ph.household_id = items.household_id AND ph.name_key = c.name_key AND ph.label = 'チョコプリン'
           ORDER BY ph.at DESC LIMIT 1),
  store_ids = (
    SELECT CASE
      WHEN ph.store_id IS NULL OR EXISTS (SELECT 1 FROM json_each(items.store_ids) WHERE value = ph.store_id)
        THEN items.store_ids
      ELSE json_insert(items.store_ids, '$[#]', ph.store_id) END
    FROM price_history ph JOIN _choco c ON c.household_id = ph.household_id
    WHERE ph.household_id = items.household_id AND ph.name_key = c.name_key AND ph.label = 'チョコプリン'
    ORDER BY ph.at DESC LIMIT 1)
WHERE EXISTS (SELECT 1 FROM _choco c WHERE c.household_id = items.household_id AND c.name_key = lower(trim(items.name)))
  AND EXISTS (SELECT 1 FROM price_history ph JOIN _choco c ON c.household_id = ph.household_id
              WHERE ph.household_id = items.household_id AND ph.name_key = c.name_key AND ph.label = 'チョコプリン');

-- 3. «プリン» vuelve a su último precio de verdad (se había quedado con el de
-- la última línea del ticket, la キャラメルプリン).
UPDATE items SET price = (
  SELECT ph.price FROM price_history ph
  WHERE ph.household_id = items.household_id AND ph.name_key = 'プリン'
  ORDER BY ph.at DESC, ph.price ASC LIMIT 1)
WHERE lower(trim(name)) = 'プリン'
  AND EXISTS (SELECT 1 FROM items c WHERE c.household_id = items.household_id AND lower(trim(c.name)) = 'キャラメルプリン')
  AND EXISTS (SELECT 1 FROM price_history ph WHERE ph.household_id = items.household_id AND ph.name_key = 'プリン');

UPDATE price_memory SET price = (
  SELECT ph.price FROM price_history ph
  WHERE ph.household_id = price_memory.household_id AND ph.name_key = 'プリン'
    AND COALESCE(ph.store_id, '') = price_memory.store_id
  ORDER BY ph.at DESC, ph.price ASC LIMIT 1)
WHERE name_key = 'プリン'
  AND EXISTS (SELECT 1 FROM price_history ph
              WHERE ph.household_id = price_memory.household_id AND ph.name_key = 'プリン'
                AND COALESCE(ph.store_id, '') = price_memory.store_id);

-- 4. Lo aprendido en «Pegar precios»: cada línea a su artículo.
INSERT INTO receipt_aliases (household_id, label_key, kind, target, updated_at)
SELECT DISTINCT household_id, 'キャラメルプリン', 'item', 'キャラメルプリン', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM items WHERE lower(trim(name)) = 'キャラメルプリン'
ON CONFLICT (household_id, label_key) DO UPDATE SET kind = 'item', target = 'キャラメルプリン';

INSERT INTO receipt_aliases (household_id, label_key, kind, target, updated_at)
SELECT c.household_id, 'チョコプリン', 'item',
       COALESCE((SELECT i.name FROM items i WHERE i.household_id = c.household_id AND lower(trim(i.name)) = c.name_key LIMIT 1),
                (SELECT p.name FROM products p WHERE p.household_id = c.household_id AND p.name_key = c.name_key LIMIT 1)),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM _choco c
WHERE true
ON CONFLICT (household_id, label_key) DO UPDATE SET kind = 'item', target = excluded.target;

DROP TABLE _choco;
