import { t, tDynamic } from "@/lib/i18n";
import { formatRating } from "@/lib/format";

export function VerificationBadge({ status }: { status: "unverified" | "verified" }) {
  return status === "verified" ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      ✓ {t("verification.verified")}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {t("verification.unverified")}
    </span>
  );
}

export function TypeBadge({ type }: { type: "kindergarten" | "training_center" }) {
  const color = type === "kindergarten" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{tDynamic("type", type)}</span>;
}

export function RatingBadge({ avg, count }: { avg: number | null; count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-700" aria-label={t("center.rating")}>
      <span className="text-amber-500">★</span>
      {t("center.ratingValue", { avg: formatRating(avg), count })}
    </span>
  );
}
