-- Corrección de una vez: el ticket de 西友 del 8 de noviembre de 2026 se pegó
-- antes de que el historial guardara la fecha del ticket, así que sus precios
-- quedaron con el día en que se pegó. Se pasan al 8 de noviembre (a mediodía
-- UTC, como los tickets de ahora), y las carnes a los nombres cortos.
--
-- Solo toca entradas con esas líneas de ticket exactas, guardadas entre el 8 y
-- el 18 de noviembre y que no tengan ya fecha de ticket (las fechas de ticket
-- caen justo a mediodía UTC).
UPDATE price_history
SET at = 1794139200000
WHERE at >= 1794096000000 AND at < 1795046400000
  AND at % 86400000 != 43200000
  AND (
    label IN (
      'じゃがいも', 'マンゴーオレンジジュース', '冷凍うどん', '卵', '牛乳🥛',
      '冷凍ポテト', 'レタス🥬', 'プリン', 'ボディーウォッシュ', '食パン🍞',
      'キッチンペーパー', 'キッチンペaperー', '岩手県産もも肉', '豚こま切れ',
      'コカコーラ 350ml', 'ブラッドオレンジ', '果実白桃'
    )
    -- Si se pegó antes de que existiera el historial, la entrada viene de los
    -- precios recordados: sin línea de ticket, pero con la tienda (西友) y el
    -- artículo de la lista.
    OR (
      label IS NULL
      AND name_key IN (
        'じゃがいも', 'マンゴーオレンジジュース', '冷凍うどん', '卵', '牛乳🥛',
        '冷凍ポテト', 'レタス🥬', 'プリン', 'ボディーウォッシュ', '食パン🍞',
        'キッチンペーパー', '肉', 'コカコーラ 350ml', 'ブラッドオレンジ', '果実白桃'
      )
      AND store_id IN (
        SELECT id FROM stores WHERE name LIKE '%西友%' OR lower(name) LIKE '%seiyu%'
      )
    )
  );

UPDATE price_history SET label = '鶏もも' WHERE label = '岩手県産もも肉';
UPDATE price_history SET label = '豚こま' WHERE label = '豚こま切れ';
