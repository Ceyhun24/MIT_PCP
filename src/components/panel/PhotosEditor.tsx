"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPhoto, deletePhoto } from "@/app/panel/merkez/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";
import { FileInput } from "./FileInput";
import { FormMessage, dangerButton, inputClass, primaryButton } from "./FormMessage";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

type Photo = { id: string; url: string; caption: string | null };

export function PhotosEditor({ centerId, photos }: { centerId: string; photos: Photo[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ status: "idle" | "ok" | "error"; message?: string }>({ status: "idle" });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const caption = (form.elements.namedItem("caption") as HTMLInputElement).value;
    if (!file) return;
    if (!TYPES[file.type]) return setState({ status: "error", message: t("photos.errorType") });
    if (file.size > MAX_BYTES) return setState({ status: "error", message: t("photos.errorSize") });
    setBusy(true);
    setState({ status: "idle" });
    // Upload straight from the browser to Supabase Storage; its policy only
    // accepts files in the folder of a center the person owns (or any, for admins).
    const path = `${centerId}/${crypto.randomUUID()}.${TYPES[file.type]}`;
    const { error } = await createClient().storage.from("center-photos").upload(path, file, { contentType: file.type });
    const result = error ? { status: "error" as const, message: t("photos.errorFailed") } : await addPhoto(centerId, path, caption);
    setBusy(false);
    setState(result);
    if (result.status === "ok") {
      form.reset();
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">{t("photos.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full rounded-lg bg-slate-100 object-cover" />
              {p.caption && <p className="text-xs text-slate-600">{p.caption}</p>}
              <form action={deletePhoto} onSubmit={(e) => { if (!confirm(t("photos.confirmDelete"))) e.preventDefault(); }}>
                <input type="hidden" name="photoId" value={p.id} />
                <button type="submit" className={`${dangerButton} w-full`}>{t("photos.delete")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <FileInput name="file" accept="image/jpeg,image/png,image/webp" required label={t("photos.upload")} help={t("photos.help")} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t("photos.caption")}</span>
          <input name="caption" maxLength={200} className={inputClass} />
        </label>
        <FormMessage state={state} />
        <button type="submit" disabled={busy} className={`${primaryButton} self-start`}>
          {busy ? t("photos.uploading") : t("photos.upload")}
        </button>
      </form>
    </div>
  );
}
