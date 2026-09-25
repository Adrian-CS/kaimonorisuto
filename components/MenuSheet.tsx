"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { LangSwitch, useI18n } from "./I18n";
import PushSettings from "./PushSettings";
import { CURRENCIES, CURRENCY_LABEL, type Currency } from "@/lib/money";
import type { Me, Store } from "@/lib/types";

export default function MenuSheet({
  me,
  stores,
  doneCount,
  onClose,
  onCreateStore,
  onRenameStore,
  onDeleteStore,
  onMoveStore,
  onClearDone,
  onSetCurrency,
}: {
  me: Me;
  stores: Store[];
  doneCount: number;
  onClose: () => void;
  onCreateStore: (name: string) => Promise<string | null>;
  onRenameStore: (id: string, name: string) => Promise<void>;
  onDeleteStore: (id: string) => Promise<void>;
  onMoveStore: (id: string, dir: -1 | 1) => Promise<void>;
  onClearDone: () => Promise<void>;
  onSetCurrency: (c: Currency) => Promise<void>;
}) {
  const { t } = useI18n();
  const [newStore, setNewStore] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <Sheet title={t("settings.title")} onClose={onClose}>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-muted">
          {t("settings.language")}
        </h3>
        <LangSwitch />
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-muted">
          {t("settings.currency")}
        </h3>
        <div className="flex gap-1">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onSetCurrency(c)}
              aria-pressed={me.currency === c}
              className={`rounded-full border px-3 py-1 text-xs ${
                me.currency === c
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted"
              }`}
            >
              {CURRENCY_LABEL[c]}
            </button>
          ))}
        </div>
      </section>

      <PushSettings />

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-muted">
          {t("settings.stores")}
        </h3>
        <p className="mb-3 text-xs text-muted">{t("settings.storesHelp")}</p>
        <ul className="mb-3 flex flex-col gap-1">
          {stores.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-2"
            >
              <span className="flex-1 truncate">{s.name}</span>
              <button
                type="button"
                className="px-2 text-muted disabled:opacity-30"
                disabled={i === 0}
                onClick={() => onMoveStore(s.id, -1)}
                aria-label={t("settings.moveUp")}
              >
                ↑
              </button>
              <button
                type="button"
                className="px-2 text-muted disabled:opacity-30"
                disabled={i === stores.length - 1}
                onClick={() => onMoveStore(s.id, 1)}
                aria-label={t("settings.moveDown")}
              >
                ↓
              </button>
              <button
                type="button"
                className="px-2 text-muted"
                onClick={() => {
                  const n = window.prompt(t("store.promptRename"), s.name);
                  if (n?.trim()) void onRenameStore(s.id, n.trim());
                }}
                aria-label={t("settings.rename")}
              >
                ✎
              </button>
              <button
                type="button"
                className="px-2 text-danger"
                onClick={() => {
                  if (window.confirm(t("store.deleteConfirm", { name: s.name })))
                    void onDeleteStore(s.id);
                }}
                aria-label={t("common.delete")}
              >
                ✕
              </button>
            </li>
          ))}
          {stores.length === 0 && (
            <li className="text-sm text-muted">{t("settings.storesEmpty")}</li>
          )}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newStore.trim()) return;
            await onCreateStore(newStore.trim());
            setNewStore("");
          }}
        >
          <input
            className="field"
            placeholder={t("store.promptNew")}
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
          />
          <button className="btn shrink-0">{t("common.add")}</button>
        </form>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-muted">
          {t("settings.share")}
        </h3>
        <p className="mb-2 text-xs text-muted">{t("settings.shareHelp")}</p>
        <button
          type="button"
          className="btn w-full font-mono text-lg tracking-[0.3em]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(me.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* sin portapapeles: el código ya está a la vista */
            }
          }}
        >
          {copied ? t("settings.copied") : me.inviteCode}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-danger"
          disabled={doneCount === 0}
          onClick={() => {
            if (window.confirm(t("settings.clearDoneConfirm", { n: doneCount })))
              void onClearDone();
          }}
        >
          {t("settings.clearDone", { n: doneCount })}
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          {t("settings.logout", { name: me.userName })}
        </button>
      </section>
    </Sheet>
  );
}
