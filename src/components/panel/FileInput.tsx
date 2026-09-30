"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

// File picker with Azerbaijani text. The browser's own button text
// ("Choose File" etc.) follows the browser language, so the real input is
// visually hidden and a styled label is shown instead.
export function FileInput({ name, accept, required, label, help }: { name: string; accept: string; required?: boolean; label: string; help?: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <label className="flex cursor-pointer flex-wrap items-center gap-3">
        <input
          type="file"
          name={name}
          accept={accept}
          required={required}
          aria-label={label}
          className="peer sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-600">
          {t("files.choose")}
        </span>
        <span className="min-w-0 break-all text-slate-600">{fileName ?? t("files.none")}</span>
      </label>
      {help && <span className="text-xs text-slate-500">{help}</span>}
    </div>
  );
}
