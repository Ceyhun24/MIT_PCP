"use client";

import { useActionState } from "react";
import { deleteCourse, saveCourse, type FormState } from "@/app/panel/merkez/[id]/actions";
import { t, tDynamic } from "@/lib/i18n";
import type { Course } from "@/lib/types";
import { FormMessage, dangerButton, inputClass, primaryButton } from "./FormMessage";

function CourseForm({ centerId, course }: { centerId: string; course?: Course }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCourse, { status: "idle" });
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const f = (label: string, input: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {input}
    </label>
  );
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="centerId" value={centerId} />
        {course && <input type="hidden" name="courseId" value={course.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {f(t("courses.name"), <input name="name" required defaultValue={course?.name} className={inputClass} />)}
          {f(t("courses.subject"), <input name="subject" defaultValue={course?.subject ?? ""} className={inputClass} />)}
          {f(t("courses.level"), <input name="level" defaultValue={course?.level ?? ""} className={inputClass} />)}
          {f(t("courses.duration"), <input name="duration" defaultValue={course?.duration ?? ""} placeholder={t("courses.durationPlaceholder")} className={inputClass} />)}
          {f(t("courses.ageMin"), <input name="age_min_years" inputMode="decimal" defaultValue={n(course?.age_min_years)} className={inputClass} />)}
          {f(t("courses.ageMax"), <input name="age_max_years" inputMode="decimal" defaultValue={n(course?.age_max_years)} className={inputClass} />)}
          {f(t("courses.price"), <input name="price_azn" inputMode="decimal" defaultValue={n(course?.price_azn)} className={inputClass} />)}
          {f(
            t("courses.period"),
            <select name="price_period" defaultValue={course?.price_period ?? ""} className={inputClass}>
              <option value="">{t("courses.noPeriod")}</option>
              {(["month", "lesson", "total"] as const).map((p) => (
                <option key={p} value={p}>{tDynamic("pricePeriod", p)}</option>
              ))}
            </select>,
          )}
        </div>
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={primaryButton}>
            {course ? t("courses.save") : t("courses.add")}
          </button>
        </div>
      </form>
      {course && (
        <form action={deleteCourse} onSubmit={(e) => { if (!confirm(t("courses.confirmDelete"))) e.preventDefault(); }}>
          <input type="hidden" name="centerId" value={centerId} />
          <input type="hidden" name="courseId" value={course.id} />
          <button type="submit" className={dangerButton}>{t("courses.delete")}</button>
        </form>
      )}
    </div>
  );
}

export function CoursesEditor({ centerId, courses }: { centerId: string; courses: Course[] }) {
  return (
    <div className="flex flex-col gap-4">
      {courses.length === 0 && <p className="text-sm text-slate-500">{t("courses.empty")}</p>}
      {courses.map((c) => (
        <CourseForm key={`${c.id}-${c.name}-${c.price_azn}`} centerId={centerId} course={c} />
      ))}
      <h3 className="mt-2 font-semibold">{t("courses.add")}</h3>
      <CourseForm key={`new-${courses.length}`} centerId={centerId} />
    </div>
  );
}
