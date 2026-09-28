import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: `${t("auth.signIn")} — ${t("app.name")}` };

export default async function SignInPage({ searchParams }: PageProps<"/giris">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("auth.title")}</h1>
        <p className="text-slate-600">{t("auth.intro")}</p>
        {params.error === "link" && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {t("auth.linkInvalid")}
          </p>
        )}
        <SignInForm next={next} />
      </main>
      <SiteFooter />
    </>
  );
}
