-- Lo comprado en una tienda (según los tickets y precios apuntados) se da por
-- disponible en ella: cada artículo y cada producto de «lo de siempre» suma a
-- sus tiendas las del historial de precios que no tuviera. Las que ya tenía
-- se quedan igual y en el mismo orden (la primera sigue siendo la principal).
-- A partir de ahora lo hace la app al pegar un ticket.

UPDATE items SET store_ids = (
  SELECT json_group_array(v) FROM (
    SELECT value AS v FROM json_each(items.store_ids)
    UNION ALL
    SELECT v FROM (
      SELECT ph.store_id AS v, MAX(ph.at) AS last
      FROM price_history ph JOIN stores s ON s.id = ph.store_id
      WHERE ph.household_id = items.household_id
        AND ph.name_key = lower(trim(items.name))
        AND ph.store_id NOT IN (SELECT value FROM json_each(items.store_ids))
      GROUP BY ph.store_id ORDER BY last DESC
    )
  )
)
WHERE EXISTS (
  SELECT 1 FROM price_history ph JOIN stores s ON s.id = ph.store_id
  WHERE ph.household_id = items.household_id
    AND ph.name_key = lower(trim(items.name))
    AND ph.store_id NOT IN (SELECT value FROM json_each(items.store_ids))
);

UPDATE products SET store_ids = (
  SELECT json_group_array(v) FROM (
    SELECT value AS v FROM json_each(products.store_ids)
    UNION ALL
    SELECT v FROM (
      SELECT ph.store_id AS v, MAX(ph.at) AS last
      FROM price_history ph JOIN stores s ON s.id = ph.store_id
      WHERE ph.household_id = products.household_id
        AND ph.name_key = products.name_key
        AND ph.store_id NOT IN (SELECT value FROM json_each(products.store_ids))
      GROUP BY ph.store_id ORDER BY last DESC
    )
  )
)
WHERE EXISTS (
  SELECT 1 FROM price_history ph JOIN stores s ON s.id = ph.store_id
  WHERE ph.household_id = products.household_id
    AND ph.name_key = products.name_key
    AND ph.store_id NOT IN (SELECT value FROM json_each(products.store_ids))
);
