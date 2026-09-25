import type { Lang } from "./i18n";

export const CURRENCIES = ["JPY", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "JPY";

/** Decimales de cada moneda. Los precios se guardan en la unidad menor. */
const DECIMALS: Record<Currency, number> = { JPY: 0, EUR: 2 };

export const CURRENCY_LABEL: Record<Currency, string> = {
  JPY: "¥ 円",
  EUR: "€ euro",
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

function locale(lang: Lang) {
  return lang === "ja" ? "ja-JP" : "es-ES";
}

/** 1200 (JPY) -> "￥1,200"  ·  1250 (EUR) -> "12,50 €" */
export function formatMoney(minor: number, currency: Currency, lang: Lang) {
  const d = DECIMALS[currency];
  try {
    return new Intl.NumberFormat(locale(lang), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(minor / 10 ** d);
  } catch {
    return `${(minor / 10 ** d).toFixed(d)} ${currency}`;
  }
}

/** Valor para el <input>: 1250 (EUR) -> "12.50"  ·  1200 (JPY) -> "1200" */
export function moneyToInput(minor: number | null, currency: Currency) {
  if (minor === null || minor === undefined) return "";
  const d = DECIMALS[currency];
  return d === 0 ? String(minor) : (minor / 10 ** d).toFixed(d);
}

/**
 * Lee lo que escriba el usuario y lo pasa a la unidad menor.
 * Acepta "12,50", "12.50", "1.200", "¥1200", "12,5 €". Devuelve null si no hay
 * ningún número reconocible.
 */
export function parseMoney(text: string, currency: Currency): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;

  const d = DECIMALS[currency];
  let normalised = cleaned;

  if (d > 0) {
    // El último separador es el decimal solo si deja 1 o 2 cifras detrás;
    // si no, es de miles ("1.200" son mil doscientos, no uno coma dos).
    const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
    const tail = lastSep === -1 ? "" : cleaned.slice(lastSep + 1);
    if (lastSep !== -1 && tail.length > 0 && tail.length <= 2) {
      normalised =
        cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + tail;
    } else {
      normalised = cleaned.replace(/[.,]/g, "");
    }
  } else {
    normalised = cleaned.replace(/[.,]/g, "");
  }

  const value = Number(normalised);
  if (!Number.isFinite(value) || value < 0) return null;

  const minor = Math.round(value * 10 ** d);
  return minor > 100_000_000 ? null : minor;
}

/** Clave con la que se recuerda el precio de un producto. */
export function nameKey(name: string) {
  return name.trim().toLocaleLowerCase();
}
