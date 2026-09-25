"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LangSwitch, useI18n } from "./I18n";
import { errorText } from "@/lib/i18n";

type Mode = "login" | "new" | "join";

export default function AuthForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : mode === "join"
          ? { name, email, password, inviteCode }
          : {
              name,
              email,
              password,
              householdName:
                householdName.trim() ||
                t("auth.defaultHousehold", { name: name.trim() }),
            };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(errorText(t, data.error));
      setBusy(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: "login", label: t("auth.tab.login") },
    { id: "new", label: t("auth.tab.new") },
    { id: "join", label: t("auth.tab.join") },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">🥕 {t("app.title")}</h1>
          <p className="text-sm text-muted">{t("app.subtitle")}</p>
        </div>
        <LangSwitch className="shrink-0 pt-1" />
      </div>

      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMode(tab.id);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm ${
              mode === tab.id ? "bg-surface-2 font-medium" : "text-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode !== "login" && (
          <input
            className="field"
            placeholder={t("auth.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        {mode === "new" && (
          <input
            className="field"
            placeholder={t("auth.householdName")}
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
          />
        )}
        {mode === "join" && (
          <input
            className="field uppercase"
            placeholder={t("auth.inviteCode")}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
          />
        )}
        <input
          className="field"
          type="email"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="field"
          type="password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button className="btn btn-primary mt-1" disabled={busy}>
          {busy ? "…" : t(`auth.submit.${mode}`)}
        </button>
      </form>
    </main>
  );
}
