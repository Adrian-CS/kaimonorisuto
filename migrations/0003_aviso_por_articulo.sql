-- Cuándo se mandó el último aviso sobre este artículo. Sirve para que la
-- campana no se pueda convertir en un martillo: el servidor ignora los avisos
-- repetidos sobre el mismo artículo dentro de un margen corto.
ALTER TABLE items ADD COLUMN notified_at INTEGER;
