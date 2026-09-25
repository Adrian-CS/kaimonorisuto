import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, pickLang, type Lang } from "./i18n";

/** Idioma de la petición actual (cookie, o Accept-Language como respaldo). */
export async function getLang(): Promise<Lang> {
  const fromCookie = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;
  try {
    return pickLang((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LANG;
  }
}
