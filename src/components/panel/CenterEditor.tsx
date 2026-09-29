"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { saveCenter, type FormState } from "@/app/panel/merkez/[id]/actions";
import { t, tDynamic } from "@/lib/i18n";
import type { EditableCenter } from "@/lib/panel";
import type { Option } from "@/lib/types";
import { FormMessage, inputClass, primaryButton, secondaryButton } from "./FormMessage";

const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100" /> });

const LANGUAGES = ["az", "ru", "en", "tr", "de", "fr"];

type Props = { center: EditableCenter; districts: (Option & { id: number })[]; amenities: string[]; admin: boolean };

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function CenterEditor({ center, districts, amenities, admin }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCenter, { status: "idle" });
  const [lat, setLat] = useState<string>(center.lat?.toFixed(6) ?? "");
  const [lng, setLng] = useState<string>(center.lng?.toFixed(6) ?? "");
  const n = (v: number | null) => (v === null ? "" : String(v));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={center.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("editor.name")} wide>
          <input name="name" required defaultValue={center.name} className={inputClass} />
        </Field>
        <Field label={t("editor.description")} wide>
          <textarea name="description" rows={3} defaultValue={center.description ?? ""} className={inputClass} />
        </Field>
        <Field label={t("editor.district")}>
          <select name="district_id" defaultValue={center.district_id ?? ""} className={inputClass}>
            <option value="">{t("editor.noDistrict")}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("editor.address")}>
          <input name="address" defaultValue={center.address ?? ""} className={inputClass} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-700">{t("editor.location")}</legend>
        <p className="text-xs text-slate-500">{t("editor.locationHelp")}</p>
        <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
          <LocationPicker
            lat={lat === "" ? null : Number(lat)}
            lng={lng === "" ? null : Number(lng)}
            onChange={(a, b) => { setLat(a.toFixed(6)); setLng(b.toFixed(6)); }}
            label={t("editor.location")}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={t("editor.lat")}>
            <input name="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("editor.lng")}>
            <input name="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
          </Field>
          <button type="button" onClick={() => { setLat(""); setLng(""); }} className={`${secondaryButton} col-span-2 self-end sm:col-span-1`}>
            {t("editor.clearLocation")}
          </button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("editor.phone")}><input name="phone" type="tel" defaultValue={center.phone ?? ""} className={inputClass} /></Field>
        <Field label={t("editor.email")}><input name="email" type="email" defaultValue={center.email ?? ""} className={inputClass} /></Field>
        <Field label={t("editor.website")}><input name="website" defaultValue={center.website ?? ""} className={inputClass} /></Field>
        <Field label={t("editor.hours")}><input name="working_hours" defaultValue={center.working_hours ?? ""} placeholder={t("editor.hoursPlaceholder")} className={inputClass} /></Field>
        <Field label={t("editor.instagram")}><input name="instagram" defaultValue={center.instagram ?? ""} className={inputClass} /></Field>
        <Field label={t("editor.facebook")}><input name="facebook" defaultValue={center.facebook ?? ""} className={inputClass} /></Field>
        <Field label={t("editor.ageMin")}><input name="age_min_years" inputMode="decimal" defaultValue={n(center.age_min_years)} className={inputClass} /></Field>
        <Field label={t("editor.ageMax")}><input name="age_max_years" inputMode="decimal" defaultValue={n(center.age_max_years)} className={inputClass} /></Field>
        <Field label={t("editor.priceMin")}><input name="price_min_azn" inputMode="decimal" defaultValue={n(center.price_min_azn)} className={inputClass} /></Field>
        <Field label={t("editor.priceMax")}><input name="price_max_azn" inputMode="decimal" defaultValue={n(center.price_max_azn)} className={inputClass} /></Field>
        <Field label={t("editor.groupSize")}><input name="group_size_max" inputMode="numeric" defaultValue={n(center.group_size_max)} className={inputClass} /></Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{t("editor.languages")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANGUAGES.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="languages" value={code} defaultChecked={center.languages.includes(code)} className="h-4 w-4 accent-emerald-600" />
              {tDynamic("languages", code)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{t("editor.amenities")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {amenities.map((slug) => (
            <label key={slug} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="amenities" value={slug} defaultChecked={center.amenity_slugs.includes(slug)} className="h-4 w-4 accent-emerald-600" />
              {tDynamic("amenities", slug)}
            </label>
          ))}
        </div>
      </fieldset>

      {admin && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <legend className="px-1 text-sm font-medium text-amber-900">{t("editor.adminOnly")}</legend>
          <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
            <span className="font-medium text-slate-700">{t("editor.type")}</span>
            <select name="type" defaultValue={center.type} className={inputClass}>
              <option value="kindergarten">{tDynamic("type", "kindergarten")}</option>
              <option value="training_center">{tDynamic("type", "training_center")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="verified" defaultChecked={center.verification_status === "verified"} className="h-4 w-4 accent-emerald-600" />
            {t("editor.verified")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="hidden" defaultChecked={center.is_hidden} className="h-4 w-4 accent-emerald-600" />
            {t("editor.hidden")}
          </label>
        </fieldset>
      )}

      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} self-start`}>
        {pending ? t("editor.saving") : t("editor.save")}
      </button>
    </form>
  );
}
