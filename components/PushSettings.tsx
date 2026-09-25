"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./I18n";

type Info = {
  enabled: boolean;
  publicKey?: string;
  myDevices?: number;
  otherDevices?: number;
};

function b64uToUint8(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64u(buf: ArrayBuffer) {
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Una suscripción queda atada a la clave VAPID con la que se creó. Si el
 * servidor cambia de claves, la vieja sigue viva en el navegador pero el push
 * service la rechaza con 403, y no hay forma de notarlo salvo comparándolas.
 */
function matchesKey(sub: PushSubscription, publicKey: string) {
  const applied = sub.options?.applicationServerKey;
  return applied ? bytesToB64u(applied) === publicKey : false;
}

export default function PushSettings() {
  const { t, lang } = useI18n();
  const [info, setInfo] = useState<Info | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/push", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Info;
    setInfo(data);
    return data;
  }, []);

  useEffect(() => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    void (async () => {
      const data = await refresh();
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = (await reg?.pushManager.getSubscription()) ?? null;
        // Una suscripción con la clave equivocada no vale: pedimos volver a activar.
        setSubscribed(
          Boolean(sub && data?.publicKey && matchesKey(sub, data.publicKey)),
        );
      } catch {
        setSubscribed(false);
      }
    })();
  }, [supported, refresh]);

  async function enable() {
    if (!info?.publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Si arrastramos una suscripción de otra clave VAPID, hay que tirarla:
      // reutilizarla daría 403 en cada envío.
      const stale = await reg.pushManager.getSubscription();
      if (stale && !matchesKey(stale, info.publicKey)) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: stale.endpoint }),
        }).catch(() => {});
        await stale.unsubscribe().catch(() => false);
      }

      const sub =
        (stale && matchesKey(stale, info.publicKey) ? stale : null) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64uToUint8(info.publicKey) as BufferSource,
        }));

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...json, lang }),
      });

      setSubscribed(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { sent?: number };
      setResult(res.ok && (data.sent ?? 0) > 0 ? "sent" : "failed");
      setTimeout(() => setResult(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-muted">
        {t("settings.notifications")}
      </h3>
      <p className="mb-3 text-xs text-muted">{t("settings.notifyHelp")}</p>

      {permission === "unsupported" ? (
        <p className="text-xs text-muted">{t("settings.notifyUnsupported")}</p>
      ) : info && !info.enabled ? (
        <p className="text-xs text-muted">{t("settings.notifyDisabled")}</p>
      ) : permission === "denied" ? (
        <p className="text-xs text-danger">{t("settings.notifyBlocked")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`btn ${subscribed ? "" : "btn-primary"}`}
            disabled={busy || !info}
            onClick={() => (subscribed ? disable() : enable())}
          >
            {subscribed ? t("settings.notifyOff") : t("settings.notifyOn")}
          </button>

          {subscribed && (
            <>
              <button type="button" className="btn" disabled={busy} onClick={test}>
                {result === "sent" ? t("settings.notifySent") : t("settings.notifyTest")}
              </button>
              {result === "failed" && (
                <p className="text-xs text-danger">{t("settings.notifyFailed")}</p>
              )}
              <p className="text-xs text-muted">
                {info?.otherDevices
                  ? t("settings.notifyOthers", { n: info.otherDevices })
                  : t("settings.notifyNoOthers")}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
