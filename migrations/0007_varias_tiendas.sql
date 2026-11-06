-- Un artículo (y un producto del histórico) puede estar en varias tiendas:
-- «leche, en Mercadona o en Seiyu». Se guarda como lista JSON de ids, en el
-- orden en que se eligieron; la primera es la principal (la que se usa para
-- el precio recordado).
--
-- La columna store_id de antes se queda (SQLite no deja borrar una columna con
-- clave foránea) pero ya no se usa: se copia aquí y se vacía.
ALTER TABLE items ADD COLUMN store_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN store_ids TEXT NOT NULL DEFAULT '[]';

UPDATE items SET store_ids = json_array(store_id), store_id = NULL
WHERE store_id IS NOT NULL;
UPDATE products SET store_ids = json_array(store_id), store_id = NULL
WHERE store_id IS NOT NULL;
