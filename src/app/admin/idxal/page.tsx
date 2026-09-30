import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { t } from "@/lib/i18n";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: `${t("admin.import")} — ${t("app.name")}` };

export default function ImportPage() {
  return (
    <AdminShell path="/admin/idxal" title={t("admin.import")}>
      <ImportForm />
    </AdminShell>
  );
}
