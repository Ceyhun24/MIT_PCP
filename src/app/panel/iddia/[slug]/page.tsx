import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { getCenter } from "@/lib/data";
import { t } from "@/lib/i18n";
import { getMyProvider } from "@/lib/panel";
import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = { title: `${t("claim.title")} — ${t("app.name")}` };

export default async function ClaimPage({ params }: PageProps<"/panel/iddia/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/iddia/${slug}`)}`);
  const res = await getCenter(slug);
  if (!res.ok || !res.data) notFound();
  const center = res.data;
  const provider = await getMyProvider(user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
        <Link href={`/merkez/${center.slug}`} className="text-sm text-emerald-700 hover:underline">← {center.name}</Link>
        <h1 className="text-2xl font-bold">{t("claim.title")}</h1>
        <p className="font-medium">{center.name}</p>
        {center.provider_id ? (
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{t("claim.alreadyOwned")}</p>
        ) : (
          <>
            <p className="text-slate-600">{t("claim.intro")}</p>
            <ClaimForm centerId={center.id} hasProvider={Boolean(provider)} />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
