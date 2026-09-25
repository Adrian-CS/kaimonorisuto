"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./I18n";

/**
 * En el móvil, al abrir el teclado el viewport de *layout* no encoge: solo lo
 * hace el visual viewport. Una hoja anclada con `inset-0` + `items-end` acaba
 * pegada a un fondo que el teclado tapa, y no se ve. Así que la seguimos:
 * el contenedor ocupa exactamente el visual viewport, y la hoja se pega a su
 * borde inferior, que siempre está justo encima del teclado.
 */
function useVisualViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => setBox({ top: vv.offsetTop, height: vv.height });
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  return box;
}

export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const viewport = useVisualViewport();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Bloquea el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      data-sheet-overlay
      className="fixed left-0 z-50 flex w-full items-end justify-center bg-black/60 sm:items-center"
      style={
        viewport
          ? { top: viewport.top, height: viewport.height }
          : { top: 0, height: "100dvh" }
      }
      onClick={onClose}
    >
      <div
        data-sheet-panel
        className="sheet flex max-h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg px-2 py-1 text-muted"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
