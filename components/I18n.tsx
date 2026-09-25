"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LANG,
  LANGS,
  LANG_COOKIE,
  LANG_NAMES,
  makeT,
  type Lang,
  type T,
} from "@/lib/i18n";

type Ctx = { lang: Lang; t: T; setLang: (l: Lang) => void };

const I18nContext = createContext<Ctx>({
  lang: DEFAULT_LANG,
  t: makeT(DEFAULT_LANG),
  setLang: () => {},
});

export function I18nProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      router.refresh();
    },
    [router],
  );

  // En la primera visita el servidor ya ha elegido idioma con la cabecera
  // Accept-Language; aqui solo lo fijamos en la cookie para que no dependa de
  // ella a partir de ahora. No cambia nada visible, asi que no refrescamos.
  useEffect(() => {
    if (document.cookie.includes(`${LANG_COOKIE}=`)) return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({ lang, t: makeT(lang), setLang }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Selector de idioma (dos botones, sin menús). */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex gap-1 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full border px-3 py-1 text-xs ${
            lang === l
              ? "border-accent bg-accent/15 text-accent"
              : "border-border text-muted"
          }`}
        >
          {LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
