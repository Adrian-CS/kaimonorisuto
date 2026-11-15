import { parseMoney, type Currency } from "./money";

/**
 * Texto de un ticket ya pasado a limpio (lo prepara Claude a partir de la foto,
 * o se escribe a mano), con este formato:
 *
 *   🧾 西友 2026-11-14     ← opcional: tienda y fecha
 *   牛乳 238
 *   卵 268円
 *   Pan de molde ¥158
 *
 * Una línea por artículo: el nombre, y el precio al final. Lo que no tenga
 * precio se ignora (y se enseña aparte, por si acaso).
 */
export type ReceiptLine = { name: string; price: number };
export type Receipt = {
  store: string | null;
  date: string | null;
  lines: ReceiptLine[];
  skipped: string[];
};

const HEADER = /^(?:🧾|#)\s*(.*)$/u;
const DATE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/;
// Nombre, espacio, y precio con su símbolo de moneda opcional delante o detrás.
const LINE = /^(.*?\S)\s+[¥€]?\s*(-?[\d][\d.,]*)\s*(?:円|€|¥|yen|eur)?$/iu;

export function parseReceiptText(text: string, currency: Currency): Receipt {
  const out: Receipt = { store: null, date: null, lines: [], skipped: [] };
  // NFKC: dígitos y símbolos de ancho completo (２３８、￥) como los normales.
  for (const raw of text.normalize("NFKC").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const header = HEADER.exec(line);
    if (header) {
      const parts = header[1].trim().split(/\s+/);
      if (parts.length && DATE.test(parts[parts.length - 1])) out.date = parts.pop()!;
      if (parts.length) out.store = parts.join(" ");
      continue;
    }

    const m = LINE.exec(line.replace(/^[-*・•]\s*/, ""));
    const price = m ? parseMoney(m[2], currency) : null;
    if (m && price !== null && price > 0) out.lines.push({ name: m[1].trim(), price });
    else out.skipped.push(line);
  }
  return out;
}
