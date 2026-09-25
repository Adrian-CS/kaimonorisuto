export const LANGS = ["es", "ja"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "es";
export const LANG_COOKIE = "idioma";

export const LANG_NAMES: Record<Lang, string> = {
  es: "Español",
  ja: "日本語",
};

const es = {
  "app.title": "Lista de la compra",
  "app.subtitle": "Compartida, con fotos y supermercados.",

  "auth.tab.login": "Entrar",
  "auth.tab.new": "Crear lista",
  "auth.tab.join": "Unirme",
  "auth.name": "Tu nombre",
  "auth.householdName": "Nombre de la casa (opcional)",
  "auth.inviteCode": "Código de invitación",
  "auth.email": "Email",
  "auth.password": "Contraseña",
  "auth.submit.login": "Entrar",
  "auth.submit.new": "Crear lista",
  "auth.submit.join": "Unirme a la lista",
  "auth.defaultHousehold": "Casa de {name}",

  "list.counts": "{pending} pendientes · {total} en total",
  "list.add": "Añadir artículo…",
  "list.addAria": "Añadir artículo",
  "list.search": "Buscar…",
  "list.empty": "La lista está vacía. Añade lo primero arriba.",
  "list.hideDone": "Ocultar comprados",
  "list.onlyPending": "Solo pendientes",
  "group.store": "Supermercado",
  "group.category": "Categoría",
  "group.none": "Sin agrupar",
  "store.none": "Sin supermercado",
  "category.none": "Sin categoría",

  "item.editAria": "Editar {name}",
  "item.edit": "Editar artículo",
  "item.name": "Nombre",
  "item.photoHelp": "Añade una foto de la marca para reconocerla en la tienda.",
  "item.photoRemove": "Quitar foto",
  "item.uploading": "Subiendo…",
  "item.notify": "Avisar a la otra persona",
  "item.notifySent": "Aviso enviado",
  "item.notifyNoOthers": "Nadie tiene las notificaciones activadas.",
  "item.notifyTooSoon": "Ya avisaste de esto hace un momento.",
  "item.notifyFailed": "No se pudo enviar el aviso.",
  "item.showExtra": "+ Precio, cantidad, categoría y nota",
  "item.qty": "Cantidad (2, 500 g, 1 pack…)",
  "item.category": "Categoría",
  "item.note": "Nota (la del tapón azul…)",
  "item.deleteConfirm": "¿Borrar «{name}»?",

  "store.promptNew": "Nombre del supermercado",
  "store.promptRename": "Nuevo nombre",
  "store.deleteConfirm": "¿Borrar «{name}»?",

  "settings.title": "Ajustes",
  "settings.stores": "Supermercados",
  "settings.storesHelp":
    "El orden de esta lista es el orden en que se agrupa la compra.",
  "settings.storesEmpty": "Todavía no hay ninguno.",
  "settings.moveUp": "Subir",
  "settings.moveDown": "Bajar",
  "settings.rename": "Renombrar",
  "settings.share": "Compartir",
  "settings.shareHelp":
    "Quien use este código al registrarse verá y editará la misma lista.",
  "settings.copied": "¡Copiado!",
  "settings.clearDone": "Borrar los comprados ({n})",
  "settings.clearDoneConfirm": "¿Borrar {n} artículos comprados?",
  "settings.logout": "Cerrar sesión ({name})",
  "settings.language": "Idioma",

  "common.add": "Añadir",
  "common.save": "Guardar",
  "common.delete": "Borrar",
  "common.close": "Cerrar",

  "item.price": "Precio orientativo",
  "item.priceSuggest": "Usar {price}",
  "list.total": "Total ~{amount}",
  "list.groupTotal": "~{amount}",

  "settings.currency": "Moneda",
  "settings.notifications": "Notificaciones",
  "settings.notifyHelp":
    "Por defecto no se avisa de nada. Cuando añadas algo, toca la campana si quieres que le llegue un aviso a la otra persona.",
  "settings.notifyOn": "Activar en este dispositivo",
  "settings.notifyOff": "Desactivar en este dispositivo",
  "settings.notifyTest": "Enviar una de prueba",
  "settings.notifyBlocked":
    "El navegador tiene bloqueadas las notificaciones para esta web. Actívalas en los ajustes del navegador.",
  "settings.notifyUnsupported":
    "Este navegador no admite notificaciones. En iPhone hay que añadir la app a la pantalla de inicio primero.",
  "settings.notifyDisabled":
    "El servidor no tiene claves VAPID configuradas, así que las notificaciones están apagadas.",
  "settings.notifyOthers": "Dispositivos del otro lado: {n}",
  "settings.notifyNoOthers":
    "Nadie más las tiene activadas todavía, así que de momento no le llegaría nada.",
  "settings.notifySent": "Enviada",
  "settings.notifyFailed":
    "No se pudo entregar. Vuelve a desactivar y activar las notificaciones en este dispositivo.",

  "list.releaseToNotify": "Soltar para avisar",
  "list.notified": "Avisado",
  "bell.on": "Avisar al añadir",
  "bell.off": "Añadir en silencio",

  "drag.handle": "Mover {name}",

  "push.title": "🥕 Lista de la compra",
  "push.body": "{name} ha añadido {item}",
  "push.ping": "{name} te recuerda: {item}",
  "push.bought": "{name} ha comprado {item}",
  "push.back": "{name} ha vuelto a poner {item} en la lista",
  "push.test": "Las notificaciones funcionan.",

  "error.name_required": "Falta el nombre",
  "error.email_invalid": "Email no válido",
  "error.password_short": "La contraseña debe tener 8 caracteres o más",
  "error.email_taken": "Ese email ya está registrado",
  "error.invalid_code": "Código de invitación no válido",
  "error.bad_credentials": "Email o contraseña incorrectos",
  "error.missing_fields": "Faltan datos",
  "error.item_name_required": "El artículo necesita un nombre",
  "error.store_name_required": "El supermercado necesita un nombre",
  "error.not_found": "No encontrado",
  "error.nothing_to_update": "Nada que actualizar",
  "error.unauthorized": "Se ha cerrado la sesión",
  "error.server_error": "Error del servidor",
  "error.photo_missing": "Falta el archivo",
  "error.photo_type": "Formato de imagen no admitido",
  "error.photo_large": "La imagen es demasiado grande",
  "error.upload_failed": "No se ha podido subir la foto",
  "error.price_invalid": "Precio no válido",
  "error.unknown": "Algo ha ido mal",
} as const;

export type Key = keyof typeof es;

const ja: Record<Key, string> = {
  "app.title": "買い物リスト",
  "app.subtitle": "写真とお店つきの共有リスト。",

  "auth.tab.login": "ログイン",
  "auth.tab.new": "リストを作る",
  "auth.tab.join": "参加する",
  "auth.name": "お名前",
  "auth.householdName": "リストの名前（任意）",
  "auth.inviteCode": "招待コード",
  "auth.email": "メールアドレス",
  "auth.password": "パスワード",
  "auth.submit.login": "ログイン",
  "auth.submit.new": "リストを作る",
  "auth.submit.join": "リストに参加する",
  "auth.defaultHousehold": "{name}のリスト",

  "list.counts": "未購入 {pending}件 ・ 全{total}件",
  "list.add": "商品を追加…",
  "list.addAria": "商品を追加",
  "list.search": "検索…",
  "list.empty": "リストは空です。上から追加してください。",
  "list.hideDone": "購入済みを隠す",
  "list.onlyPending": "未購入のみ",
  "group.store": "お店",
  "group.category": "カテゴリ",
  "group.none": "グループなし",
  "store.none": "お店なし",
  "category.none": "カテゴリなし",

  "item.editAria": "{name}を編集",
  "item.edit": "商品を編集",
  "item.name": "商品名",
  "item.photoHelp": "ブランドの写真を追加すると、お店で見分けやすくなります。",
  "item.photoRemove": "写真を削除",
  "item.uploading": "アップロード中…",
  "item.notify": "相手に知らせる",
  "item.notifySent": "知らせました",
  "item.notifyNoOthers": "相手はまだ通知を有効にしていません。",
  "item.notifyTooSoon": "さきほど知らせたばかりです。",
  "item.notifyFailed": "知らせを送れませんでした。",
  "item.showExtra": "＋ 値段・数量・カテゴリ・メモ",
  "item.qty": "数量（2、500g、1パックなど）",
  "item.category": "カテゴリ",
  "item.note": "メモ（青いキャップのやつ など）",
  "item.deleteConfirm": "「{name}」を削除しますか？",

  "store.promptNew": "お店の名前",
  "store.promptRename": "新しい名前",
  "store.deleteConfirm": "「{name}」を削除しますか？",

  "settings.title": "設定",
  "settings.stores": "お店",
  "settings.storesHelp": "ここの並び順が、買い物リストの並び順になります。",
  "settings.storesEmpty": "まだ登録がありません。",
  "settings.moveUp": "上へ",
  "settings.moveDown": "下へ",
  "settings.rename": "名前を変更",
  "settings.share": "共有",
  "settings.shareHelp":
    "登録するときにこのコードを使うと、同じリストを一緒に使えます。",
  "settings.copied": "コピーしました",
  "settings.clearDone": "購入済みを削除（{n}件）",
  "settings.clearDoneConfirm": "購入済みの{n}件を削除しますか？",
  "settings.logout": "ログアウト（{name}）",
  "settings.language": "言語",

  "common.add": "追加",
  "common.save": "保存",
  "common.delete": "削除",
  "common.close": "閉じる",

  "item.price": "だいたいの値段",
  "item.priceSuggest": "{price} を使う",
  "list.total": "合計 約{amount}",
  "list.groupTotal": "約{amount}",

  "settings.currency": "通貨",
  "settings.notifications": "通知",
  "settings.notifyHelp":
    "普段は通知しません。商品を追加するときにベルを押したときだけ、相手に通知が届きます。",
  "settings.notifyOn": "この端末で有効にする",
  "settings.notifyOff": "この端末で無効にする",
  "settings.notifyTest": "テスト通知を送る",
  "settings.notifyBlocked":
    "ブラウザでこのサイトの通知がブロックされています。ブラウザの設定から許可してください。",
  "settings.notifyUnsupported":
    "このブラウザは通知に対応していません。iPhoneではまずホーム画面に追加してください。",
  "settings.notifyDisabled":
    "サーバーにVAPIDキーが設定されていないため、通知は使えません。",
  "settings.notifyOthers": "相手の端末：{n}台",
  "settings.notifyNoOthers": "相手はまだ通知を有効にしていないので、今は届きません。",
  "settings.notifySent": "送信しました",
  "settings.notifyFailed":
    "送信できませんでした。この端末で通知を一度オフにしてから、もう一度オンにしてください。",

  "list.releaseToNotify": "離すと知らせます",
  "list.notified": "知らせました",
  "bell.on": "追加したら知らせる",
  "bell.off": "知らせずに追加",

  "drag.handle": "{name}を移動",

  "push.title": "🥕 買い物リスト",
  "push.body": "{name}が「{item}」を追加しました",
  "push.ping": "{name}さんからのリマインド：「{item}」",
  "push.bought": "{name}が「{item}」を買いました",
  "push.back": "{name}が「{item}」をリストに戻しました",
  "push.test": "通知は正常に動いています。",

  "error.name_required": "お名前を入力してください",
  "error.email_invalid": "メールアドレスが正しくありません",
  "error.password_short": "パスワードは8文字以上にしてください",
  "error.email_taken": "このメールアドレスは登録済みです",
  "error.invalid_code": "招待コードが正しくありません",
  "error.bad_credentials": "メールアドレスかパスワードが違います",
  "error.missing_fields": "入力が足りません",
  "error.item_name_required": "商品名を入力してください",
  "error.store_name_required": "お店の名前を入力してください",
  "error.not_found": "見つかりません",
  "error.nothing_to_update": "更新する項目がありません",
  "error.unauthorized": "ログインし直してください",
  "error.server_error": "サーバーエラーが発生しました",
  "error.photo_missing": "ファイルがありません",
  "error.photo_type": "対応していない画像形式です",
  "error.photo_large": "画像が大きすぎます",
  "error.upload_failed": "写真をアップロードできませんでした",
  "error.price_invalid": "値段が正しくありません",
  "error.unknown": "エラーが発生しました",
};

const DICTS: Record<Lang, Record<Key, string>> = { es, ja };

export type T = (key: Key, params?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const dict = DICTS[lang] ?? DICTS[DEFAULT_LANG];
  return (key, params) => {
    let s = dict[key] ?? es[key] ?? key;
    if (params)
      for (const [k, v] of Object.entries(params))
        s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/** Traduce el código de error que devuelve la API. */
export function errorText(t: T, code: unknown): string {
  const key = `error.${String(code)}` as Key;
  return key in es ? t(key) : t("error.unknown");
}

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

/** Elige idioma a partir de la cabecera Accept-Language del navegador. */
export function pickLang(acceptLanguage: string | null): Lang {
  if (!acceptLanguage) return DEFAULT_LANG;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";");
      const q = rest.find((r) => r.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("es")) return "es";
  }
  return DEFAULT_LANG;
}
