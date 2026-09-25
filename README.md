# 🥕 Lista de la compra / 買い物リスト

Lista de la compra compartida, pensada para el móvil y **bilingüe
español/japonés**. Cada artículo puede llevar una **foto** (para reconocer la
marca en la tienda) y un **supermercado**, y la lista se agrupa por tienda o por
categoría.

Todo lo demás es opcional: se puede usar escribiendo solo el nombre.

- **Precio orientativo** por artículo, con totales por tienda. La app recuerda
  el último precio de cada producto, así que solo se escribe una vez.
- **Notificaciones que no molestan**: por defecto no avisa de nada; hay una
  campana junto al campo de añadir y solo avisa cuando la enciendes.
- **Reordenar arrastrando**, y al soltar en otro grupo se cambia de tienda o
  de categoría.
- **Categorías como las tiendas**: se crean una vez en Ajustes (o con el «+» de
  la ficha) y luego se eligen de una lista.
- **Cambios en bloque**: «Seleccionar», marcas varios artículos y les pones la
  misma categoría o el mismo supermercado de una vez.

## Stack

| Pieza | Qué es |
|---|---|
| Next.js 16 (App Router) + TypeScript + Tailwind 4 | app |
| `@opennextjs/cloudflare` | adaptador para desplegar Next en Workers |
| Cloudflare D1 (SQLite) | base de datos |
| Cloudflare R2 | fotos |
| Cloudflare Workers | hosting |

Sin Supabase y sin dependencias de pago. Las fotos se redimensionan y comprimen
**en el navegador** antes de subirlas (~100 KB por foto), así que caben decenas
de miles dentro del tramo gratuito.

## Idiomas

- Diccionario único en `lib/i18n.ts` (`es` y `ja`); no hay literales sueltos en
  los componentes, y la API devuelve **códigos** de error (`bad_credentials`,
  `email_taken`…) que el cliente traduce.
- El idioma se elige solo: el servidor lee el `Accept-Language` del navegador
  (`lib/lang.ts`) y ya pinta la primera página en el idioma correcto, sin
  parpadeo. Tu pareja abre el enlace desde un móvil en japonés y lo ve en
  japonés, sin tocar nada. Después queda fijado en la cookie `idioma`, que pone
  el cliente en el primer render.
- Se puede cambiar a mano en **Ajustes → Idioma** y en la pantalla de login. Es
  una preferencia por persona/dispositivo, no de la lista: tú en español y ella
  en japonés sobre los mismos datos.
- Añadir un tercer idioma = añadir una clave más en `lib/i18n.ts`; TypeScript se
  queja si falta alguna cadena.

## Estructura

```
app/
  page.tsx                 lista (server: comprueba sesión y precarga datos)
  login/page.tsx           entrar / crear lista / unirse
  api/
    auth/{register,login,logout}
    snapshot                 estado completo (lo que refresca el polling)
    items, items/[id]        CRUD de artículos
    stores, stores/[id]      supermercados
    categories, categories/[id]  categorías (renombrar/borrar arrastra a sus artículos)
    items/bulk               PATCH categoría/tienda de varios artículos a la vez
    items/order              PATCH nuevo orden tras arrastrar
    photos                   POST subir a R2
    photos/[...key]          GET servir desde R2 (comprobando el hogar)
    prices                   GET precio recordado de un producto
    push, push/test          suscripción a notificaciones y prueba
    household                PATCH ajustes del hogar (moneda)
components/
  ListView.tsx             la lista, agrupación, optimistic updates
  ItemSheet.tsx            editor de artículo (foto, súper, campos opcionales)
  MenuSheet.tsx            idioma, moneda, notificaciones, tiendas, invitación
  PushSettings.tsx         alta/baja de notificaciones en este dispositivo
  I18n.tsx                 contexto de idioma + selector
lib/
  i18n.ts                  diccionario es/ja
  auth.ts                  PBKDF2 + sesiones en cookie
  db.ts, queries.ts, image.ts, api.ts, types.ts
  lang.ts                  idioma de la petición (cookie o Accept-Language)
  money.ts                 formato y parseo de precios (¥ / €)
  push.ts                  VAPID + cifrado aes128gcm para Web Push
  notify.ts                a quién avisar y en qué idioma
public/sw.js               service worker (solo notificaciones)
scripts/vapid.mjs          genera las claves VAPID
scripts/push-selftest.mjs  prueba real del cifrado de Web Push
migrations/
  0001_init.sql
  0002_precio_y_avisos.sql
  0003_aviso_por_articulo.sql
  0004_categorias.sql
```

## Precio orientativo

Es un campo opcional más, escondido tras «+ Precio, cantidad, categoría y nota».
Cuando algún artículo tiene precio aparecen los totales: uno por grupo en su
cabecera y el de toda la compra junto al contador de arriba. Solo suma lo
**pendiente**, así que baja según vas marcando.

Para que no haya que teclear precios cada semana, la tabla `price_memory` guarda
el último precio de cada producto en cada tienda (`name_key` = el nombre en
minúsculas). Al añadir un artículo que ya compraste, el precio viene puesto; en
el editor, si el campo está vacío, sale un botón con el precio recordado.

Es una estimación tuya, no un gasto real: no lleva a ninguna contabilidad ni se
guarda ningún histórico de compras.

La moneda es del hogar y se cambia en **Ajustes → Moneda** (¥ sin decimales, €
con dos). Los precios se guardan siempre como enteros en la unidad menor
(yenes, o céntimos) para no arrastrar errores de coma flotante.

## Notificaciones

El comportamiento es al revés de lo habitual: **por defecto no se notifica
nada**. Junto al campo de añadir hay una campana apagada; si la enciendes, el
siguiente artículo que añadas manda un aviso a la otra persona, y la campana se
apaga sola. Nunca te llega un aviso de algo que has añadido tú.

Cada persona activa las notificaciones por dispositivo en **Ajustes →
Notificaciones**, donde también hay un botón para mandarse una de prueba.

Web Push va implementado a mano en `lib/push.ts` (VAPID + cifrado `aes128gcm`
con WebCrypto), porque las librerías de siempre asumen Node y no corren en
Workers. `scripts/push-selftest.mjs` monta una suscripción falsa, deja que el
código la cifre y la descifra desde el otro lado, además de verificar la firma
del JWT:

```bash
node scripts/push-selftest.mjs
```

**Configuración** (una vez):

```bash
node scripts/vapid.mjs                    # genera el par de claves
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT     # mailto:tu@email
```

Las mismas tres líneas en un fichero `.dev.vars` para probarlo en local. Si no
están configuradas, la app funciona igual y la sección de notificaciones dice
que están apagadas.

> **iPhone:** Safari solo permite notificaciones web si la app está **añadida a
> la pantalla de inicio** (Compartir → Añadir a pantalla de inicio). Abierta
> como una pestaña normal no llega nada. En Android funciona sin más.

## Reordenar arrastrando

El tirador `⠿` de cada fila. Mientras arrastras, la lista no se mueve: sigue una
copia flotante al dedo y una línea marca dónde va a caer, así que las medidas
tomadas al empezar siguen siendo válidas y no hay saltos.

Al soltar se renumera todo y se guarda en una sola llamada (`PATCH
/api/items/order`, un `db.batch`). Con la vista agrupada por supermercado,
soltar en otro grupo **le cambia la tienda** — es la forma rápida de clasificar
sin abrir la ficha. Con la vista por categoría pasa lo mismo con la categoría.
Los grupos vacíos se pintan en gris justo para poder soltar ahí.

## Categorías y cambios en bloque

Las categorías funcionan como los supermercados: una lista del hogar, con orden
manual, que se gestiona en **Ajustes → Categorías** y se elige en la ficha del
artículo (el «+» de al lado crea una nueva sin salir). El orden de esa lista es
el orden de los grupos al agrupar por categoría.

Los artículos guardan el **nombre** de la categoría en `items.category`, no un
id, así que la migración `0004_categorias.sql` no toca datos: crea la tabla
`categories` a partir de las categorías que ya estaban escritas (fusionando
mayúsculas/minúsculas). Renombrar una categoría la renombra en sus artículos, y
borrarla los deja sin categoría.

Para no ir artículo por artículo, el botón **Seleccionar** de la barra de filtros
cambia el toque de las filas: en vez de tachar, marca. Tocar el título de un
grupo lo marca entero. Abajo aparece una barra con dos desplegables, «Poner
categoría…» y «Poner súper…», que se aplican a todos los marcados en una sola
llamada (`PATCH /api/items/bulk`). También se puede crear una categoría o tienda
nueva desde ahí mismo. «Listo» sale del modo selección.

### Modelo de datos

`households` (una casa = una lista, con su moneda) → `users` → `sessions` y
`push_subscriptions`, y `stores` + `categories` + `items` + `price_memory` colgando del hogar. Compartir la lista = registrarse con el **código de
invitación** de la casa (Ajustes → Compartir).

Todos los campos opcionales de un artículo (`qty`, `category`, `note`,
`store_id`, `photo_key`, `price`) son `NULL` por defecto; el editor los esconde hasta que
pulsas «+ Cantidad, categoría y nota».

### Seguridad de las fotos

La clave en R2 es `lista-compra/{household_id}/{uuid}.jpg` y la ruta que las
sirve comprueba que el prefijo coincide con el hogar de la sesión, así que una
casa no puede leer las fotos de otra. Verificado en `e2e.mjs`.

## Desplegar (ya tienes cuenta y otro proyecto en Cloudflare)

Como ya tienes Cloudflare en marcha, lo único que importa es **no chocar con lo
que ya hay**. Comprueba primero contra qué cuenta vas a trabajar y qué nombres
están ocupados:

```bash
npm install
npx wrangler whoami                 # ¿la sesión correcta? si no: npx wrangler login
npx wrangler d1 list
npx wrangler r2 bucket list
npx wrangler deployments list       # workers ya desplegados
```

**Si tienes más de una cuenta**, wrangler pregunta en cada comando. Para evitarlo,
crea un `.dev.vars` o exporta la variable antes de nada:

```bash
export CLOUDFLARE_ACCOUNT_ID=<el id de la cuenta que quieras>
```

Tres nombres en `wrangler.jsonc` tienen que ser únicos dentro de tu cuenta. Si
alguno choca con tu proyecto anterior, cámbialos aquí y en los scripts `db:*` de
`package.json`:

| En `wrangler.jsonc` | Valor por defecto | Choca si… |
|---|---|---|
| `name` | `lista-compra` | ya tienes un Worker así (te sobreescribiría el despliegue) |
| `d1_databases[0].database_name` | `lista-compra` | ya tienes una D1 con ese nombre |
| `r2_buckets[0].bucket_name` | `lista-compra-fotos` | ya tienes ese bucket |

Luego:

```bash
# 1) base de datos
npx wrangler d1 create lista-compra
#    pega el database_id que imprime en wrangler.jsonc (sustituye PON_AQUI_EL_DATABASE_ID)

# 2) bucket de fotos
npx wrangler r2 bucket create lista-compra-fotos

# 3) migraciones en remoto (hay que repetirlo cada vez que haya una nueva)
npm run db:remote

# 4) desplegar
npm run deploy
```

Te queda en `https://lista-compra.<tu-subdominio>.workers.dev`. Para ponerle
dominio propio: panel de Cloudflare → Workers & Pages → `lista-compra` →
Settings → Domains & Routes → Add custom domain.

### Notas por venir de un proyecto previo

- **R2 ya activado.** Si tu proyecto anterior ya usa R2, no te va a pedir tarjeta
  otra vez. Si nunca lo has activado, hacerlo pide un método de pago aunque no
  pases del tramo gratuito; en ese caso se puede cambiar el binding `PHOTOS` por
  un KV namespace (1 GB gratis, sin tarjeta) tocando solo
  `app/api/photos/route.ts` y `app/api/photos/[...key]/route.ts`.
- **Reutilizar un bucket que ya tengas.** Todas las claves van bajo el prefijo
  `lista-compra/` (constante `PHOTO_PREFIX` en `lib/db.ts`), así que puedes poner
  el nombre de un bucket existente en `wrangler.jsonc` sin mezclarte con lo que
  ya guardas ahí.
- **Los límites del plan gratis son de cuenta, no de proyecto.** Los 100 000
  requests/día de Workers se reparten entre todos tus Workers. Para dos personas
  y una lista de la compra es irrelevante, pero tenlo en cuenta si el otro
  proyecto tiene tráfico.
- **La D1 es independiente.** No comparte nada con la base del otro proyecto.
- **`compatibility_date`** está en `2026-08-01`. Si tu otro proyecto usa otra, no
  pasa nada: es por Worker.

## Desarrollo local

```bash
npm run db:local     # aplica migraciones a la D1 local
npm run dev          # next dev con los bindings de Cloudflare
```

Para probar el bundle real de Workers antes de desplegar:

```bash
npm run preview      # build de OpenNext + wrangler dev en :8787
```

## Tests end-to-end

`e2e.mjs` recorre con Playwright el flujo completo **en los dos idiomas** (50
pasos): detección de idioma por `Accept-Language`, registro, alta de artículos,
marcar comprado, supermercados, subida y servido de la foto desde R2, precio y
totales, precio recordado al volver a añadir, cambio de moneda, arrastrar entre
grupos, la campana (que por defecto no avisa y se apaga sola), la API de push,
agrupaciones, cambio de idioma en caliente, código de invitación, aislamiento
entre casas, sesión caducada y errores de la API traducidos.

```bash
npm i -D playwright
npm run preview &     # deja el servidor en :8787
node e2e.mjs
node scripts/push-selftest.mjs
```

## Si algo peta

**`error TS2353: 'eslint' does not exist in type 'NextConfig'`** — Next 16 quitó
esa clave. Ya no está en `next.config.ts`; si reaparece al copiar un config
viejo, bórrala.

**`The "middleware" file convention is deprecated`** — en Next 16 el fichero se
llamaría `proxy.ts` y correría en runtime **Node**, que en Workers sigue siendo
experimental. Por eso aquí no hay ninguno: la detección de idioma vive en
`lib/lang.ts` (servidor) y la cookie la fija `components/I18n.tsx` (cliente).

**Bindings duplicados en `wrangler.jsonc`** — `wrangler d1 create` y
`wrangler r2 bucket create` imprimen un snippet para pegar. Si lo pegas encima
del que ya viene, acabas con dos entradas para la misma base y el mismo bucket
(la segunda con `"remote": true`, que haría que dev fuese contra remoto). Debe
haber **una sola** entrada en `d1_databases` y una en `r2_buckets`, con bindings
`DB` y `PHOTOS`.

**Windows** — OpenNext avisa de que no está pensado para Windows. En la práctica
compila, pero si te da fallos raros en el bundling, WSL va sobre seguro.

## Ideas para después

- Reconocer la marca desde la foto (OCR o Workers AI) en vez de solo mirarla.
- Listas recurrentes: marcar productos «de siempre» y rellenar la lista de golpe.
- Historial de compras y export, si algún día quieres enlazarlo con el kakeibo.
