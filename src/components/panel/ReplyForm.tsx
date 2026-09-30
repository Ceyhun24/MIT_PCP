"use client";

import { useActionState } from "react";
import { saveReply, type FormState } from "@/app/panel/merkez/[id]/actions";
import { t } from "@/lib/i18n";
import { FormMessage, inputClass, primaryButton } from "./FormMessage";

export function ReplyForm({ reviewId, centerId, existing }: { reviewId: string; centerId: string; existing: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveReply, { status: "idle" });
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="centerId" value={centerId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{existing ? t("replies.yourReply") : t("replies.reply")}</span>
        <textarea name="body" rows={3} required minLength={2} maxLength={4000} defaultValue={existing ?? ""} placeholder={t("replies.placeholder")} className={inputClass} />
      </label>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} self-start text-sm`}>{t("replies.save")}</button>
    </form>
  );
}
