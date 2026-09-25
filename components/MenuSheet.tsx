"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { LangSwitch, useI18n } from "./I18n";
import PushSettings from "./PushSettings";
import { CURRENCIES, CURRENCY_LABEL, type Currency } from "@/lib/money";
import type { Category, Me, Store } from "@/lib/types";

export default function MenuSheet({
  me,
  stores,
  categories,
  doneCount,
  onClose,
  onCreateStore,
  onRenameStore,
  onDeleteStore,
  onMoveStore,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveCategory,
  onClearDone,
  onSetCurrency,
}: {
  me: Me;
  stores: Store[];
  categories: Category[];
  doneCount: number;
  onClose: () => void;
  onCreateStore: (name: string) => Promise<string | null>;
  onRenameStore: (id: string, name: string) => Promise<void>;
  onDeleteStore: (id: string) => Promise<void>;
  onMoveStore: (id: string, dir: -1 | 1) => Promise<void>;
  onCreateCategory: (name: string) => Promise<string | null>;
  onRenameCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onMoveCategory: (id: string, dir: -1 | 1) => Promise<void>;
  onClearDone: () => Promise<void>;
  onSetCurrency: (c: Currency) => Promise<void>;
}) {
  const { t } = useI18n();
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

      <NameList
        title={t("settings.stores")}
        help={t("settings.storesHelp")}
        placeholder={t("store.promptNew")}
        entries={stores}
        deleteConfirm={(name) => t("store.deleteConfirm", { name })}
        onCreate={onCreateStore}
        onRename={onRenameStore}
        onDelete={onDeleteStore}
        onMove={onMoveStore}
      />

      <NameList
        title={t("settings.categories")}
        help={t("settings.categoriesHelp")}
        placeholder={t("category.promptNew")}
        entries={categories}
        deleteConfirm={(name) => t("category.deleteConfirm", { name })}
        onCreate={onCreateCategory}
        onRename={onRenameCategory}
        onDelete={onDeleteCategory}
        onMove={onMoveCategory}
      />

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

/** Lista editable de nombres con orden manual: supermercados y categorías. */
function NameList({
  title,
  help,
  placeholder,
  entries,
  deleteConfirm,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  title: string;
  help: string;
  placeholder: string;
  entries: { id: string; name: string }[];
  deleteConfirm: (name: string) => string;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, dir: -1 | 1) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      <p className="mb-3 text-xs text-muted">{help}</p>
      <ul className="mb-3 flex flex-col gap-1">
        {entries.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-2"
          >
            <span className="flex-1 truncate">{s.name}</span>
            <button
              type="button"
              className="px-2 text-muted disabled:opacity-30"
              disabled={i === 0}
              onClick={() => onMove(s.id, -1)}
              aria-label={t("settings.moveUp")}
            >
              ↑
            </button>
            <button
              type="button"
              className="px-2 text-muted disabled:opacity-30"
              disabled={i === entries.length - 1}
              onClick={() => onMove(s.id, 1)}
              aria-label={t("settings.moveDown")}
            >
              ↓
            </button>
            <button
              type="button"
              className="px-2 text-muted"
              onClick={() => {
                const n = window.prompt(t("store.promptRename"), s.name);
                if (n?.trim()) void onRename(s.id, n.trim());
              }}
              aria-label={t("settings.rename")}
            >
              ✎
            </button>
            <button
              type="button"
              className="px-2 text-danger"
              onClick={() => {
                if (window.confirm(deleteConfirm(s.name))) void onDelete(s.id);
              }}
              aria-label={t("common.delete")}
            >
              ✕
            </button>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-sm text-muted">{t("settings.storesEmpty")}</li>
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          await onCreate(draft.trim());
          setDraft("");
        }}
      >
        <input
          className="field"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn shrink-0">{t("common.add")}</button>
      </form>
    </section>
  );
}
