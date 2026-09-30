"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setState("sending");
    const { error: err } = await createClient().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (err) {
      setState("idle");
      setError(err.status === 429 ? t("auth.rateLimited") : t("auth.failed"));
      return;
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">{t("auth.sentTitle")}</h2>
        <p className="mt-2 text-emerald-900">{t("auth.sent", { email: email.trim() })}</p>
        <button type="button" onClick={() => setState("idle")} className="mt-3 text-sm text-emerald-800 underline">
          {t("auth.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="email" className="text-sm font-medium text-slate-700">
        {t("auth.email")}
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.emailPlaceholder")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "email-error" : undefined}
        className="rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
      {error && (
        <p id="email-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {state === "sending" ? t("auth.sending") : t("auth.send")}
      </button>
    </form>
  );
}
