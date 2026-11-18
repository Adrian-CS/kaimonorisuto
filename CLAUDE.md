# Lista de la compra (kaimonorisuto)

PWA de lista de la compra compartida (es/ja): Next.js en Cloudflare Workers
(OpenNext), D1 y R2. Ver README.md para la arquitectura y el despliegue.

- Desplegar = push a `main` (el workflow pasa el e2e y luego despliega y
  aplica migraciones). Solo cuando el usuario lo pida expresamente.
- Antes de subir: `npx tsc --noEmit`, `npm run lint` y el e2e
  (`npm run db:local`, `npx opennextjs-cloudflare build`,
  `npx opennextjs-cloudflare preview` y `node e2e.mjs`).

## Pasar un ticket a texto

El usuario manda fotos de tickets (sobre todo japoneses) y el texto resultante
se pega en Ajustes → «Pegar precios» (formato en `lib/receipt.ts`). Reglas,
siempre:

1. **Primera línea: tienda y fecha del ticket**, `🧾 西友 2026-11-14`. La
   fecha es la que pone el ticket (no la de hoy): el historial de precios la
   guarda en ese día. Usa el nombre de la tienda tal y como está en la app si
   se conoce.
2. **Una línea por producto: `nombre precio`**, con el precio en yenes, sin
   símbolo ni separadores raros (`牛乳 238`).
3. **Precio siempre con impuesto (税込).** Si el ticket da precios sin
   impuesto (税抜) y el impuesto aparte, súmalo a cada línea: 8 % comida
   (軽減税率, suele ir marcada con ※ o ＊), 10 % lo demás. Redondea al yen.
4. **Descuentos (値引・割引・クーポン) restados del producto al que van**,
   no como línea aparte. Si se compra 2 veces lo mismo, una línea por unidad
   o el precio unitario (no el total de las dos).
5. **Nombres cortos y siempre iguales**, sin marca, peso, 特売 ni códigos:
   `国産豚こま切れ肉 特売` → `豚こま`. Así los genéricos (肉, 魚…) se agrupan
   por tipo en la ficha. Tipos de carne habituales: `豚こま`, `豚バラ`,
   `豚ひき`, `鶏もも`, `鶏むね`, `鶏ひき`, `牛こま`, `牛ひき`, `合いびき`.
   Para lo que ya está en la lista, usa el mismo nombre que en la lista si
   el usuario la ha pasado (Ajustes → «Copiar mi lista»).
6. Fuera: totales, 小計, 合計, お預り, お釣り, bolsas (レジ袋) salvo que se
   pida, y puntos de tarjeta.
7. Si una línea no se lee bien, dilo aparte en lugar de inventar el precio.
