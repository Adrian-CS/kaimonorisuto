import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), "lista-compra-e2e");
const SHOTS = path.join(TMP, "shots");
const MARCA = path.join(TMP, "marca.png");

const BASE = "http://localhost:8787";
fs.mkdirSync(SHOTS, { recursive: true });
// Imagen de prueba para el campo de foto, por si no está ya ahí.
if (!fs.existsSync(MARCA))
  fs.writeFileSync(
    MARCA,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

// Etiquetas visibles en cada idioma (deben coincidir con lib/i18n.ts).
const S = {
  es: {
    accept: "es-ES,es;q=0.9",
    tabNew: "Crear lista",
    tabJoin: "Unirme",
    name: "Tu nombre",
    household: "Nombre de la casa (opcional)",
    invite: "Código de invitación",
    email: "Email",
    password: "Contraseña",
    submitNew: "Crear lista",
    submitJoin: "Unirme a la lista",
    add: "Añadir artículo…",
    settings: "Ajustes",
    storeName: "Nombre del supermercado",
    addBtn: "Añadir",
    close: "Cerrar",
    delete: "Borrar",
    editItem: (n) => `Editar ${n}`,
    showExtra: "+ Precio, cantidad, categoría y nota",
    qty: "Cantidad (2, 500 g, 1 pack…)",
    category: "Categoría",
    note: "Nota (la del tapón azul…)",
    save: "Guardar",
    groupStore: "Supermercado",
    groupCategory: "Categoría",
    noStore: "Sin supermercado",
    hideDone: "Ocultar comprados",
    onlyPending: "Solo pendientes",
    clearDone: /Borrar los comprados/,
    langOther: "日本語",
    qtyValue: "2 botes",
    categoryValue: "Desayuno",
    noteValue: "La grande, no la de avellana light",
    storeA: "Mercadona",
    storeB: "Seiyu",
    price: "Precio orientativo",
    showExtraLabel: "+ Precio, cantidad, categoría y nota",
    bellOff: "Añadir en silencio",
    bellOn: "Avisar al añadir",
    notifyItem: "Avisar a la otra persona",
    notifyNoOthers: "Nadie tiene las notificaciones activadas.",
    releaseToNotify: "Soltar para avisar",
    dragHandle: (n) => `Mover ${n}`,
    notifications: "Notificaciones",
    priceShown: "1234 ¥",
    priceEur: "12,34 €",
  },
  ja: {
    accept: "ja-JP,ja;q=0.9",
    tabNew: "リストを作る",
    tabJoin: "参加する",
    name: "お名前",
    household: "リストの名前（任意）",
    invite: "招待コード",
    email: "メールアドレス",
    password: "パスワード",
    submitNew: "リストを作る",
    submitJoin: "リストに参加する",
    add: "商品を追加…",
    settings: "設定",
    storeName: "お店の名前",
    addBtn: "追加",
    close: "閉じる",
    delete: "削除",
    editItem: (n) => `${n}を編集`,
    showExtra: "＋ 値段・数量・カテゴリ・メモ",
    qty: "数量（2、500g、1パックなど）",
    category: "カテゴリ",
    note: "メモ（青いキャップのやつ など）",
    save: "保存",
    groupStore: "お店",
    groupCategory: "カテゴリ",
    noStore: "お店なし",
    hideDone: "購入済みを隠す",
    onlyPending: "未購入のみ",
    clearDone: /購入済みを削除/,
    langOther: "Español",
    qtyValue: "2本",
    categoryValue: "朝ごはん",
    noteValue: "大きいほう、ヘーゼルナッツのじゃないやつ",
    storeA: "西友",
    storeB: "オーケー",
    price: "だいたいの値段",
    showExtraLabel: "＋ 値段・数量・カテゴリ・メモ",
    bellOff: "知らせずに追加",
    bellOn: "追加したら知らせる",
    notifyItem: "相手に知らせる",
    notifyNoOthers: "相手はまだ通知を有効にしていません。",
    releaseToNotify: "離すと知らせます",
    dragHandle: (n) => `${n}を移動`,
    notifications: "通知",
    priceShown: "￥1,234",
    priceEur: "€12.34",
  },
};

const ITEMS = ["Nutella", "Papel Albal", "人参", "Fanta limón", "Sprite"];

let failures = 0;

async function main() {
  // En el contenedor el navegador vive en una ruta fija; fuera de él, deja que
  // Playwright use el que tenga instalado.
  const fixed = "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(
    fs.existsSync(fixed) ? { executablePath: fixed } : {},
  );

  for (const lang of ["es", "ja"]) {
    console.log(`\n=== ${lang} ===`);
    await run(browser, lang, S[lang]);
  }

  await browser.close();
  if (failures) {
    console.error(`\n${failures} pasos fallidos.`);
    process.exitCode = 1;
  } else {
    console.log("\nTodo en verde.");
  }
}

async function run(browser, lang, s) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: lang === "ja" ? "ja-JP" : "es-ES",
    extraHTTPHeaders: { "Accept-Language": s.accept },
  });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("dialog", (d) => d.accept());

  const step = async (name, fn) => {
    process.stdout.write(`▶ ${name}… `);
    try {
      await fn();
      console.log("ok");
    } catch (e) {
      console.log("FALLO");
      console.error("  " + e.message.split("\n")[0]);
      await page.screenshot({
        path: `${SHOTS}/error-${lang}-${name.replace(/\W+/g, "-")}.png`,
      });
      failures++;
      // Deja la UI en un estado limpio para que un fallo no arrastre a los demás.
      try {
        const overlay = page.locator("div.fixed.inset-0");
        if (await overlay.count())
          await page
            .getByRole("button", { name: s.close, exact: true })
            .click({ timeout: 2000 });
      } catch {
        /* nada que cerrar */
      }
    }
  };

  const stamp = Date.now();

  await step("idioma detectado por el navegador", async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const htmlLang = await page.getAttribute("html", "lang");
    if (htmlLang !== lang) throw new Error(`<html lang> = ${htmlLang}`);
    await page.waitForSelector(`text=${s.tabNew}`);
    await page.screenshot({ path: `${SHOTS}/${lang}-00-login.png` });
  });

  await step("registro", async () => {
    await page.getByRole("button", { name: s.tabNew }).first().click();
    await page.getByPlaceholder(s.name).fill("Adrian");
    await page.getByPlaceholder(s.household).fill("Nerima");
    await page.getByPlaceholder(s.email).fill(`a+${lang}${stamp}@test.com`);
    await page.getByPlaceholder(s.password).fill("contrasena123");
    await page.getByRole("button", { name: s.submitNew }).last().click();
    await page.waitForURL(`${BASE}/`, { timeout: 15000 });
    await page.waitForSelector("text=Nerima");
  });

  await step("añadir artículos", async () => {
    for (const n of ITEMS) {
      await page.getByPlaceholder(s.add).fill(n);
      await page.getByPlaceholder(s.add).press("Enter");
      await page.waitForTimeout(250);
    }
    const c = await page.locator("main ul li").count();
    if (c !== ITEMS.length) throw new Error(`esperaba ${ITEMS.length}, hay ${c}`);
  });

  await step("marcar comprado", async () => {
    await page
      .locator("main ul li")
      .filter({ hasText: "Sprite" })
      .getByRole("button")
      .first()
      .click();
    await page.waitForTimeout(400);
    await page.waitForSelector(".line-through");
  });

  await step("crear supermercados", async () => {
    await page.getByRole("button", { name: s.settings }).click();
    for (const name of [s.storeA, s.storeB]) {
      await page.getByPlaceholder(s.storeName).fill(name);
      await page.getByRole("button", { name: s.addBtn, exact: true }).click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${SHOTS}/${lang}-02-ajustes.png` });
    await page.getByRole("button", { name: s.close, exact: true }).click();
  });

  await step("editar artículo: tienda, foto y campos opcionales", async () => {
    await page.getByRole("button", { name: s.editItem("Nutella") }).click();
    await page.selectOption("select", { label: s.storeA });
    await page.setInputFiles('input[type="file"]', MARCA);
    await page.waitForSelector('img[src^="/api/photos/"]', { timeout: 20000 });
    await page.getByRole("button", { name: s.showExtraLabel }).click();
    await page.getByPlaceholder(s.price).fill("1234");
    await page.getByPlaceholder(s.qty).fill(s.qtyValue);
    await page.getByPlaceholder(s.category, { exact: true }).fill(s.categoryValue);
    await page.getByPlaceholder(s.note).fill(s.noteValue);
    await page.screenshot({ path: `${SHOTS}/${lang}-03-editor.png` });
    await page.getByRole("button", { name: s.save }).click();
    await page.waitForTimeout(600);
    await page.waitForSelector(`text=${s.qtyValue}`);
  });

  await step("la foto se sirve desde R2", async () => {
    const src = await page
      .locator('main img[src^="/api/photos/"]')
      .first()
      .getAttribute("src");
    const res = await page.request.get(BASE + src);
    if (!res.ok()) throw new Error(`GET ${src} -> ${res.status()}`);
    if (!res.headers()["content-type"]?.startsWith("image/"))
      throw new Error("content-type inesperado");
  });

  await step("agrupar por supermercado", async () => {
    await page.getByRole("button", { name: s.groupStore, exact: true }).click();
    await page.waitForTimeout(300);
    await page.waitForSelector(`text=${s.storeA}`);
    await page.waitForSelector(`text=${s.noStore}`);
    await page.screenshot({ path: `${SHOTS}/${lang}-01-lista.png` });
  });

  await step("agrupar por categoría", async () => {
    await page.getByRole("button", { name: s.groupCategory, exact: true }).click();
    await page.waitForTimeout(300);
    await page.waitForSelector(`text=${s.categoryValue}`);
    await page.getByRole("button", { name: s.groupStore, exact: true }).click();
  });

  await step("ocultar comprados", async () => {
    await page.getByRole("button", { name: s.hideDone }).click();
    await page.waitForTimeout(300);
    const c = await page.locator("main ul li").count();
    if (c !== ITEMS.length - 1) throw new Error(`esperaba 4 visibles, hay ${c}`);
    await page.getByRole("button", { name: s.onlyPending }).click();
  });

  await step("persistencia tras recargar", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("text=Nutella");
    await page.waitForSelector('main img[src^="/api/photos/"]');
  });

  await step("precio en la fila y totales", async () => {
    await page.waitForSelector(`text=${s.priceShown}`);
    // total del grupo en la cabecera + total general en la cabecera de la app
    // Intl mete espacios duros; normalizamos antes de comparar.
    const norm = (x) => (x ?? "").replace(/\s/g, " ");
    const header = norm(await page.locator("main > header p").first().textContent());
    if (!header.includes(norm(s.priceShown)))
      throw new Error(`cabecera sin total: ${header}`);
  });

  await step("precio recordado al volver a añadir", async () => {
    await page.getByPlaceholder(s.add).fill("Nutella");
    await page.getByPlaceholder(s.add).press("Enter");
    await page.waitForTimeout(900);
    const rows = page.locator("main ul li", { hasText: "Nutella" });
    const n = await rows.count();
    if (n !== 2) throw new Error(`esperaba 2 Nutella, hay ${n}`);
    // la nueva tiene que traer el precio puesto sola
    const withPrice = await page
      .locator("main ul li", { hasText: "Nutella" })
      .filter({ hasText: s.priceShown })
      .count();
    if (withPrice !== 2) throw new Error(`solo ${withPrice} con precio`);
    // limpieza: borramos la nueva (la que no tiene foto), no la original
    const nueva = page
      .locator("main ul li", { hasText: "Nutella" })
      .filter({ hasNot: page.locator("img") });
    if ((await nueva.count()) !== 1)
      throw new Error(`no distingo la Nutella nueva (${await nueva.count()})`);
    await nueva.getByRole("button", { name: s.editItem("Nutella") }).click();
    await page.getByRole("button", { name: s.delete, exact: true }).click();
    await page.waitForTimeout(700);
    if ((await page.locator("main ul li", { hasText: "Nutella" }).count()) !== 1)
      throw new Error("la limpieza no dejó exactamente una Nutella");
  });

  await step("cambiar de moneda", async () => {
    await page.getByRole("button", { name: s.settings }).click();
    await page.getByRole("button", { name: "€ euro" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: s.close, exact: true }).click();
    await page.waitForSelector(`text=${s.priceEur}`);
    // y de vuelta a yenes
    await page.getByRole("button", { name: s.settings }).click();
    await page.getByRole("button", { name: "¥ 円" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: s.close, exact: true }).click();
    await page.waitForSelector(`text=${s.priceShown}`);
  });

  await step("arrastrar a otro supermercado", async () => {
    await page.getByRole("button", { name: s.groupStore, exact: true }).click();
    await page.waitForTimeout(300);

    const handle = page.getByRole("button", { name: s.dragHandle("Papel Albal") });
    const from = await handle.boundingBox();
    const targetRow = page.locator("main ul li", { hasText: "Nutella" }).first();
    const to = await targetRow.boundingBox();
    if (!from || !to) throw new Error("no encuentro las filas");

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(900);

    // Papel Albal tiene que haber acabado en el grupo de la primera tienda
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: s.editItem("Papel Albal") }).click();
    const selected = await page.locator("select").inputValue();
    if (!selected) throw new Error("sigue sin supermercado tras arrastrarlo");
    await page.getByRole("button", { name: s.close, exact: true }).click();
  });

  await step("la hoja se queda visible con el teclado abierto", async () => {
    // Sustituimos visualViewport por uno controlable: es lo que encoge en el
    // móvil al abrirse el teclado (el viewport de layout no se entera).
    await page.evaluate(() => {
      const fake = new EventTarget();
      fake.height = window.innerHeight;
      fake.width = window.innerWidth;
      fake.offsetTop = 0;
      fake.offsetLeft = 0;
      fake.pageTop = 0;
      fake.pageLeft = 0;
      fake.scale = 1;
      Object.defineProperty(window, "visualViewport", {
        value: fake,
        configurable: true,
      });
      window.__vv = fake;
    });

    await page.getByRole("button", { name: s.editItem("Nutella") }).click();
    await page.waitForSelector("[data-sheet-panel]");

    // Teclado fuera: ~360 px visibles arriba del todo.
    const KEYBOARD_TOP = 360;
    await page.evaluate((h) => {
      window.__vv.height = h;
      window.__vv.dispatchEvent(new Event("resize"));
    }, KEYBOARD_TOP);
    await page.waitForTimeout(300);

    const overlay = await page.locator("[data-sheet-overlay]").boundingBox();
    if (Math.abs((overlay?.height ?? 0) - KEYBOARD_TOP) > 2)
      throw new Error(`el overlay mide ${overlay?.height}, esperaba ${KEYBOARD_TOP}`);

    const panel = await page.locator("[data-sheet-panel]").boundingBox();
    if (!panel) throw new Error("no encuentro la hoja");
    if (panel.y + panel.height > KEYBOARD_TOP + 2)
      throw new Error(
        `la hoja acaba en ${panel.y + panel.height}, tapada por el teclado`,
      );
    if (panel.height < 100) throw new Error(`la hoja quedó en ${panel.height}px`);

    // Los botones de guardar/borrar tienen que seguir siendo alcanzables.
    await page.getByRole("button", { name: s.save }).scrollIntoViewIfNeeded();
    const save = await page.getByRole("button", { name: s.save }).boundingBox();
    if (!save || save.y + save.height > KEYBOARD_TOP + 2)
      throw new Error("el botón de guardar queda fuera de la pantalla");

    await page.getByRole("button", { name: s.close, exact: true }).click();
    await page.reload({ waitUntil: "networkidle" });
  });

  await step("abrir la ficha no abre el teclado solo", async () => {
    await page.getByRole("button", { name: s.editItem("Nutella") }).click();
    await page.waitForSelector("[data-sheet-panel]");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    if (focused === "INPUT" || focused === "TEXTAREA")
      throw new Error(`se autoenfocó un ${focused}`);
    await page.getByRole("button", { name: s.close, exact: true }).click();
  });

  await step("la campana manda notify y se apaga sola", async () => {
    let sentNotify = null;
    const onReq = (req) => {
      if (req.method() === "POST" && req.url().endsWith("/api/items")) {
        try {
          sentNotify = JSON.parse(req.postData() ?? "{}").notify;
        } catch {
          sentNotify = "ilegible";
        }
      }
    };
    page.on("request", onReq);

    // por defecto, silencio
    await page.getByPlaceholder(s.add).fill("Silencioso");
    await page.getByPlaceholder(s.add).press("Enter");
    await page.waitForTimeout(700);
    if (sentNotify !== false) throw new Error(`por defecto mandó notify=${sentNotify}`);

    // con la campana encendida, avisa
    await page.getByRole("button", { name: s.bellOff }).click();
    await page.getByPlaceholder(s.add).fill("Con aviso");
    await page.getByPlaceholder(s.add).press("Enter");
    await page.waitForTimeout(700);
    if (sentNotify !== true) throw new Error(`con campana mandó notify=${sentNotify}`);

    // y vuelve a apagarse sola
    await page.waitForSelector(`[aria-label="${s.bellOff}"]`);
    page.off("request", onReq);
  });

  await step("API de push disponible", async () => {
    const res = await page.request.get(`${BASE}/api/push`);
    const data = await res.json();
    if (!data.enabled) throw new Error("push deshabilitado (¿faltan claves VAPID?)");
    if (!/^[A-Za-z0-9_-]{80,}$/.test(data.publicKey ?? ""))
      throw new Error(`clave pública rara: ${data.publicKey}`);
  });

  await step("un push a una suscripción muerta no rompe el alta", async () => {
    const fake = {
      endpoint: "https://fcm.googleapis.com/fcm/send/inexistente-de-prueba",
      keys: {
        p256dh:
          "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSvHc1FQ8kTmAg7_XGr_ZaOTBjbBhCM4Aw",
        auth: "8eDyX_uCN0XRhSbY5hs7Hg",
      },
      lang: "es",
    };
    const sub = await page.request.post(`${BASE}/api/push`, { data: fake });
    if (!sub.ok()) throw new Error(`no acepta la suscripción: ${sub.status()}`);

    // añadir con aviso debe seguir devolviendo 200 aunque el envío falle
    const res = await page.request.post(`${BASE}/api/items`, {
      data: { name: "Con push falso", notify: true },
    });
    if (!res.ok()) throw new Error(`POST /api/items -> ${res.status()}`);
    await page.request.delete(`${BASE}/api/push`, { data: {} });
  });

  await step("avisar de un artículo que ya está en la lista", async () => {
    // Sin artículo no hay aviso.
    const missing = await page.request.post(`${BASE}/api/items/no-existe/notify`);
    if (missing.status() !== 404)
      throw new Error(`artículo inexistente -> ${missing.status()}`);

    // Con artículo pero sin nadie suscrito, lo dice en vez de fingir que fue.
    const created = await page.request.post(`${BASE}/api/items`, {
      data: { name: "Para avisar" },
    });
    const { id } = await created.json();
    const res = await page.request.post(`${BASE}/api/items/${id}/notify`);
    if (!res.ok()) throw new Error(`POST notify -> ${res.status()}`);
    const data = await res.json();
    if (data.sent !== 0 || data.reason !== "no_devices")
      throw new Error(`esperaba no_devices, llegó ${JSON.stringify(data)}`);
  });

  await step("la campana de la hoja está conectada", async () => {
    await page.reload();
    await page.getByRole("button", { name: s.editItem("Para avisar") }).click();
    await page.waitForSelector("[data-sheet-panel]");
    await page.getByRole("button", { name: s.notifyItem }).click();
    // Nadie suscrito: debe salir el aviso, no un silencio ambiguo.
    await page.waitForSelector(`text=${s.notifyNoOthers}`, { timeout: 5000 });
    await page.getByRole("button", { name: s.close, exact: true }).click();
  });

  await step("mantener pulsado marca y avisa; soltar fuera lo aborta", async () => {
    await page.reload();
    const row = page.locator("main ul li").filter({ hasText: "Para avisar" });
    const box = await row.boundingBox();
    const cx = box.x + 40;
    const cy = box.y + box.height / 2;

    // Apartar el dedo antes de soltar no debe cambiar nada.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.waitForSelector(`text=${s.releaseToNotify}`);
    await page.mouse.move(cx + 60, cy); // se pasa del margen: aborta
    await page.mouse.up();
    await page.waitForTimeout(500);
    if (await row.locator(".line-through").count())
      throw new Error("el gesto abortado marcó el artículo igualmente");

    // Soltar encima sí: marca y, sin nadie suscrito, lo dice.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForSelector(`text=${s.notifyNoOthers}`, { timeout: 5000 });
    await page.waitForSelector(".line-through");
  });

  await step("un toque normal sigue siendo solo toggle", async () => {
    let toggled = 0;
    const onReq = (req) => {
      if (req.method() === "POST" && req.url().includes("/notify")) toggled++;
    };
    page.on("request", onReq);
    const row = page.locator("main ul li").filter({ hasText: "Para avisar" });
    await row.getByRole("button").first().click();
    await page.waitForTimeout(600);
    page.off("request", onReq);
    if (toggled !== 0) throw new Error("un toque normal mandó un aviso");
  });

  let inviteCode = "";
  await step("código de invitación", async () => {
    await page.getByRole("button", { name: s.settings }).click();
    const btn = page.locator("button.font-mono");
    inviteCode = (await btn.textContent())?.trim() ?? "";
    if (!/^[A-Z0-9]{6}$/.test(inviteCode))
      throw new Error(`código raro: ${inviteCode}`);
  });

  await step("cambiar de idioma desde ajustes", async () => {
    await page.getByRole("button", { name: s.langOther }).click();
    await page.waitForTimeout(1200);
    const other = lang === "es" ? "ja" : "es";
    const htmlLang = await page.getAttribute("html", "lang");
    if (htmlLang !== other) throw new Error(`<html lang> = ${htmlLang}`);
    await page.waitForSelector(`text=${S[other].settings}`);
    // vuelve al idioma original
    await page.getByRole("button", { name: S[other].langOther }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: s.close, exact: true }).click();
  });

  await step("la pareja se une con el código", async () => {
    const c2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "Accept-Language": s.accept },
    });
    const p2 = await c2.newPage();
    await p2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p2.getByRole("button", { name: s.tabJoin, exact: true }).click();
    await p2.getByPlaceholder(s.name).fill("Pareja");
    await p2.getByPlaceholder(s.invite).fill(inviteCode);
    await p2.getByPlaceholder(s.email).fill(`p+${lang}${stamp}@test.com`);
    await p2.getByPlaceholder(s.password).fill("contrasena123");
    await p2.getByRole("button", { name: s.submitJoin }).click();
    await p2.waitForURL(`${BASE}/`, { timeout: 15000 });
    await p2.waitForSelector("text=Nutella");
    await c2.close();
  });

  await step("aislamiento entre casas", async () => {
    const c3 = await browser.newContext({
      extraHTTPHeaders: { "Accept-Language": s.accept },
    });
    const p3 = await c3.newPage();
    await p3.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p3.getByRole("button", { name: s.tabNew }).first().click();
    await p3.getByPlaceholder(s.name).fill("Otro");
    await p3.getByPlaceholder(s.email).fill(`o+${lang}${stamp}@test.com`);
    await p3.getByPlaceholder(s.password).fill("contrasena123");
    await p3.getByRole("button", { name: s.submitNew }).last().click();
    await p3.waitForURL(`${BASE}/`, { timeout: 15000 });
    if (await p3.locator("text=Nutella").count())
      throw new Error("¡ve los artículos de otra casa!");

    const src = await page
      .locator('main img[src^="/api/photos/"]')
      .first()
      .getAttribute("src");
    const res = await p3.request.get(BASE + src);
    if (res.status() !== 404)
      throw new Error(`otra casa puede leer la foto: ${res.status()}`);
    await c3.close();
  });

  await step("sin sesión redirige a /login", async () => {
    const c4 = await browser.newContext();
    const p4 = await c4.newPage();
    await p4.goto(`${BASE}/`, { waitUntil: "networkidle" });
    if (!p4.url().endsWith("/login")) throw new Error(`url: ${p4.url()}`);
    const res = await p4.request.get(`${BASE}/api/snapshot`);
    if (res.status() !== 401) throw new Error(`snapshot: ${res.status()}`);
    await c4.close();
  });

  await step("error de login traducido", async () => {
    const c5 = await browser.newContext({
      extraHTTPHeaders: { "Accept-Language": s.accept },
    });
    const p5 = await c5.newPage();
    await p5.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p5.getByPlaceholder(s.email).fill("nadie@test.com");
    await p5.getByPlaceholder(s.password).fill("malamala");
    await p5.getByRole("button", { name: S[lang].tabLogin ?? "" }).count();
    await p5.locator("form button").click();
    const msg = await p5.locator("p.text-danger").textContent({ timeout: 10000 });
    const expected =
      lang === "es"
        ? "Email o contraseña incorrectos"
        : "メールアドレスかパスワードが違います";
    if (msg?.trim() !== expected) throw new Error(`mensaje: ${msg}`);
    await c5.close();
  });

  await step("borrar comprados", async () => {
    const before = await page.locator("main ul li").count();
    const done = await page.locator("main ul li .line-through").count();
    if (done === 0) throw new Error("no hay ninguno comprado que borrar");
    await page.getByRole("button", { name: s.settings }).click();
    await page.getByRole("button", { name: s.clearDone }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: s.close, exact: true }).click();
    const after = await page.locator("main ul li").count();
    if (after !== before - done) throw new Error(`esperaba ${before - done}, hay ${after}`);
    if (await page.locator("main ul li .line-through").count())
      throw new Error("siguen quedando comprados");
  });

  if (errors.length) {
    console.error("Errores de consola:\n" + errors.join("\n"));
    failures++;
  }

  await ctx.close();
}

await main();
