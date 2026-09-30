"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { t, tDynamic } from "@/lib/i18n";
import { parseCsv } from "../../../../scripts/seed/lib/csv";
import { validateCenters, validateCourses } from "../../../../scripts/seed/lib/validate";
import { runImport } from "../../../../scripts/seed/lib/importer";

export type ImportState = {
  status: "idle" | "issues" | "checked" | "done" | "error";
  lines?: string[];
  summary?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

// "Yoxla" validates and shows what would change (writes nothing);
// "İdxal et" validates again and writes, using the admin's own session.
export async function importCsv(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const mode = fd.get("mode") === "import" ? "import" : "check";
  const centersFile = fd.get("centers");
  const coursesFile = fd.get("courses");
  if (!(centersFile instanceof File) || centersFile.size === 0) return { status: "error", summary: t("admin.importNoFile") };
  if (centersFile.size > MAX_BYTES || (coursesFile instanceof File && coursesFile.size > MAX_BYTES)) return { status: "error", summary: t("photos.errorSize") };

  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) return { status: "error", summary: t("admin.forbidden") };

  const centers = parseCsv(await centersFile.text());
  const courses = coursesFile instanceof File && coursesFile.size > 0 ? parseCsv(await coursesFile.text()) : [];
  const issues = [...validateCenters(centers), ...validateCourses(courses, new Set(centers.map((c) => c.external_id)))];
  if (issues.length) {
    return {
      status: "issues",
      summary: t("admin.importIssues", { count: issues.length }),
      lines: issues.slice(0, 200).map((i) => `${i.file}, ${t("admin.line", { line: i.line })}: ${tDynamic("importIssues", i.code, i.params)}`),
    };
  }

  try {
    const result = await runImport(supabase, centers, courses, mode === "check");
    const plan = t("admin.importPlan", { create: result.create, update: result.update, skipped: result.skippedProtected, courses: result.courses });
    if (mode === "check") return { status: "checked", summary: `${t("admin.importOk")} ${plan}` };
    revalidatePath("/");
    revalidatePath("/admin/merkezler");
    return {
      status: result.failed.length ? "error" : "done",
      summary: `${t("admin.importDone", { done: result.done.length })} ${result.failed.length ? t("admin.importFailed", { count: result.failed.length }) : ""}`,
      lines: result.failed.map((f) => `${f.name}: ${f.error}`),
    };
  } catch (err) {
    console.error("import failed", err);
    return { status: "error", summary: t("editor.errorFailed") };
  }
}
