"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18n";

const MAX_SCALE = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SCALE = 2.5;
const CLOSE_DRAG = 120; // píxeles hacia abajo para cerrar deslizando

type View = { scale: number; x: number; y: number };
const RESET: View = { scale: 1, x: 0, y: 0 };

/**
 * Foto a pantalla completa. Pellizcar o doble toque para ampliar, arrastrar
 * para moverse por ella ampliada, y deslizar hacia abajo o tocar una vez (sin
 * zoom), ✕ o Escape para cerrar.
 *
 * El zoom es propio (pointer events + transform) porque el de la página está
 * desactivado en móvil y, aunque no lo estuviera, ampliaría toda la app.
 */
export default function PhotoViewer({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>(RESET);
  const [dragY, setDragY] = useState(0); // desplazamiento del gesto de cerrar
  const [animate, setAnimate] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: View;
    // Pellizco: distancia y centro iniciales entre los dos dedos.
    dist?: number;
    cx?: number;
    cy?: number;
    // Un dedo: dónde empezó.
    px?: number;
    py?: number;
    moved?: boolean;
  } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  // Va en fase de captura en window para que el Escape no cierre también la
  // ficha que hay debajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  function begin() {
    const pts = [...pointers.current.values()];
    const start = viewRef.current;
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = {
        start,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    } else if (pts.length === 1) {
      gesture.current = { start, px: pts[0].x, py: pts[0].y, moved: false };
    } else {
      gesture.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimate(false);
    begin();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];

    if (pts.length >= 2 && g.dist) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const scale = Math.min(MAX_SCALE, Math.max(1, (g.start.scale * dist) / g.dist));
      // Mantiene bajo los dedos el punto de la foto donde empezó el pellizco.
      const k = scale / g.start.scale;
      const ox = cx - window.innerWidth / 2;
      const oy = cy - window.innerHeight / 2;
      const sx = g.cx! - window.innerWidth / 2;
      const sy = g.cy! - window.innerHeight / 2;
      setView({
        scale,
        x: ox - (sx - g.start.x) * k,
        y: oy - (sy - g.start.y) * k,
      });
      return;
    }

    if (pts.length === 1 && g.px !== undefined) {
      const dx = pts[0].x - g.px;
      const dy = pts[0].y - g.py!;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (g.start.scale > 1) {
        setView({ ...g.start, x: g.start.x + dx, y: g.start.y + dy });
      } else if (dy > 0) {
        setDragY(dy);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    let next = viewRef.current;

    if (wasSingle && g && g.px !== undefined) {
      if (dragY > CLOSE_DRAG) {
        onClose();
        return;
      }
      setAnimate(true);
      setDragY(0);

      if (!g.moved) {
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0;
          if (tapTimer.current) clearTimeout(tapTimer.current);
          if (next.scale > 1) next = RESET;
          else {
            // Amplía hacia el punto tocado.
            const ox = e.clientX - window.innerWidth / 2;
            const oy = e.clientY - window.innerHeight / 2;
            next = {
              scale: DOUBLE_TAP_SCALE,
              x: -ox * (DOUBLE_TAP_SCALE - 1),
              y: -oy * (DOUBLE_TAP_SCALE - 1),
            };
          }
        } else {
          lastTap.current = now;
          // Un toque suelto sin zoom cierra, pero esperando por si es el
          // primero de un doble toque.
          if (next.scale === 1)
            tapTimer.current = setTimeout(onClose, DOUBLE_TAP_MS);
        }
      }
    }
    if (next.scale <= 1.01) next = RESET;
    viewRef.current = next;
    setView(next);
    // Si queda un dedo tras un pellizco, sigue como arrastre desde ahí.
    begin();
  }

  const fade = dragY > 0 ? Math.max(0.3, 1 - dragY / 400) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("photo.viewer")}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: `rgb(0 0 0 / ${0.92 * fade})` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Ocupa toda la pantalla para que las fotos pequeñas también se vean
        // grandes; object-contain la deja entera, sin recortar.
        className="h-full w-full touch-none object-contain select-none"
        style={{
          transform: `translate(${view.x}px, ${view.y + dragY}px) scale(${view.scale})`,
          transition: animate ? "transform 200ms ease-out" : "none",
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-lg text-white"
      >
        ✕
      </button>
    </div>
  );
}
