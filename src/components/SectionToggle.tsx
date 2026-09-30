import Link from "next/link";
import { t } from "@/lib/i18n";
import { filtersToQuery, type Filters } from "@/lib/search";

// The "Bağçalar / Tədris mərkəzləri" switch on the home page. Plain links, so
// it works without JavaScript and keeps the other filters.
export function SectionToggle({ filters }: { filters: Filters }) {
  const items: { type: Filters["type"]; label: string }[] = [
    { type: "kindergarten", label: t("sections.kindergarten") },
    { type: "training_center", label: t("sections.training_center") },
  ];
  return (
    <nav aria-label={t("sections.label")} className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:self-start">
      {items.map((item) => {
        const active = filters.type === item.type;
        return (
          <Link
            key={item.label}
            href={`/${filtersToQuery({ ...filters, type: item.type, page: 1 })}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-center text-sm font-medium sm:px-5 ${
              active ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
