"use client";

import { startTransition, useActionState } from "react";
import { FileInput } from "@/components/panel/FileInput";
import { primaryButton, secondaryButton } from "@/components/panel/FormMessage";
import { t } from "@/lib/i18n";
import { importCsv, type ImportState } from "./actions";

const styles: Record<ImportState["status"], string> = {
  idle: "",
  checked: "bg-emerald-50 text-emerald-900",
  done: "bg-emerald-50 text-emerald-900",
  issues: "bg-amber-50 text-amber-900",
  error: "bg-red-50 text-red-800",
};

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importCsv, { status: "idle" });

  // Submitted by hand (not <form action>) so React does not clear the chosen
  // files after "Yoxla" — the same files are then sent again with "İdxal et".
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value ?? "check";
    if (mode === "import" && !confirm(t("admin.importConfirm"))) return;
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    startTransition(() => action(fd));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{t("admin.importIntro")}</p>
      <FileInput name="centers" accept=".csv,text/csv" required label={t("admin.centersFile")} />
      <FileInput name="courses" accept=".csv,text/csv" label={t("admin.coursesFile")} />
      {state.status !== "idle" && (
        <div role={state.status === "error" || state.status === "issues" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${styles[state.status]}`}>
          <p className="font-medium">{state.summary}</p>
          {state.lines && state.lines.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {state.lines.map((l, i) => <li key={i} className="break-words">{l}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="mode" value="check" disabled={pending} className={secondaryButton}>{t("admin.check")}</button>
        <button
          type="submit"
          name="mode"
          value="import"
          disabled={pending || state.status !== "checked"}
          className={primaryButton}
        >
          {t("admin.runImport")}
        </button>
      </div>
    </form>
  );
}
