"use client";

import { useActionState } from "react";
import { FormMessage, inputClass, primaryButton } from "@/components/panel/FormMessage";
import { t } from "@/lib/i18n";
import { submitClaim, type ClaimState } from "./actions";

export function ClaimForm({ centerId, hasProvider }: { centerId: string; hasProvider: boolean }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(submitClaim, { status: "idle" });
  if (state.status === "ok") return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="centerId" value={centerId} />
      {!hasProvider && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("claim.organization")}</span>
            <input name="organization" required minLength={2} maxLength={120} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("claim.contactPhone")}</span>
            <input name="phone" type="tel" className={inputClass} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("claim.message")}</span>
        <textarea name="message" rows={4} maxLength={2000} placeholder={t("claim.messagePlaceholder")} className={inputClass} />
      </label>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} self-start`}>{t("claim.submit")}</button>
    </form>
  );
}
