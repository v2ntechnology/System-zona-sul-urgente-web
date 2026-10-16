import type { Metadata } from "next";
import Link from "next/link";

import { adminRoutes } from "@/config/admin-navigation";
import { formatSize } from "@/lib/ads/validate";
import { formatCount } from "@/lib/chart";
import { cn } from "@/lib/utils";
import { getSlotsOverview } from "@/services/admin/ads-service";
import type { AdSlotOverview } from "@/types/admin";
import type { AdSlotKey } from "@/types/news";

export const metadata: Metadata = { title: "Posições de anúncio" };

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

const pages: { key: AdSlotOverview["page"]; title: string }[] = [
  { key: "home", title: "Página inicial" },
  { key: "article", title: "Matéria" },
  { key: "category", title: "Editoria" },
  { key: "mobile", title: "Celular (todas as páginas)" },
];

// Posições (FE-157): onde cada anúncio aparece (esboço da página), quem ocupa hoje e o
// desempenho de 7 dias. Sem campanha, o AdSense preenche; "Fim da matéria" fica vazio.
export default async function SlotsPage() {
  const slots = await getSlotsOverview();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {pages.map((page) => {
        const onPage = slots.filter((s) => s.page === page.key);
        return (
          <section
            key={page.key}
            aria-labelledby={`pagina-${page.key}`}
            className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-xs sm:flex-row"
          >
            <div className="flex shrink-0 flex-col items-center gap-2">
              <h2 id={`pagina-${page.key}`} className="font-heading text-sm font-bold sm:hidden">
                {page.title}
              </h2>
              <Wireframe page={page.key} slots={onPage} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <h2 className="hidden font-heading text-base font-bold sm:block">{page.title}</h2>
              <ol className="flex flex-col divide-y">
                {onPage.map((slot) => (
                  <li key={slot.key} className="flex flex-col gap-1 py-3 first:pt-0">
                    <div className="flex items-baseline gap-2">
                      <Marker n={slotNumber(slot.key)} />
                      <span className="text-sm font-semibold">{slot.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {slot.sizes.map(formatSize).join(" · ")}
                      </span>
                    </div>
                    <p className="pl-7 text-sm">
                      {slot.campaign ? (
                        <Link
                          href={adminRoutes.campaign(slot.campaign.id)}
                          className="font-medium text-brand-blue hover:underline"
                        >
                          {slot.campaign.advertiser} — {slot.campaign.name}
                        </Link>
                      ) : slot.fallback === "ADSENSE" ? (
                        <span className="text-muted-foreground">
                          Livre para venda · Google AdSense preenche
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Livre para venda · fica vazia</span>
                      )}
                    </p>
                    <p className="pl-7 text-xs text-muted-foreground tabular-nums">
                      {formatCount(slot.impressions7d)} impressões ·{" "}
                      {slot.impressions7d
                        ? percent.format(slot.clicks7d / slot.impressions7d)
                        : "—"}{" "}
                      CTR em 7 dias
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const ORDER: AdSlotKey[] = [
  "HOME_TOP",
  "HOME_MIDDLE",
  "HOME_SIDEBAR",
  "ARTICLE_TOP",
  "ARTICLE_MIDDLE",
  "ARTICLE_BOTTOM",
  "CATEGORY_TOP",
  "MOBILE_STICKY",
];
const slotNumber = (key: AdSlotKey) => ORDER.indexOf(key) + 1;

function Marker({ n }: { n: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[0.65rem] font-bold text-white">
      {n}
    </span>
  );
}

/** Esboço da página com as posições numeradas (ocupada = azul; livre = tracejada). */
function Wireframe({ page, slots }: { page: AdSlotOverview["page"]; slots: AdSlotOverview[] }) {
  const slot = (key: AdSlotKey, className: string) => {
    const s = slots.find((x) => x.key === key);
    if (!s) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-sm",
          s.campaign
            ? "bg-brand-blue/15 ring-1 ring-brand-blue"
            : "border border-dashed border-muted-foreground/50",
          className,
        )}
      >
        <Marker n={slotNumber(key)} />
      </div>
    );
  };
  const line = (w: string) => <div className={cn("h-1.5 rounded-full bg-muted", w)} />;
  const block = (className: string) => <div className={cn("rounded-sm bg-muted", className)} />;

  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 flex-col gap-1.5 rounded-lg border bg-background p-2 shadow-xs",
        page === "mobile" ? "h-64 w-32" : "h-64 w-44",
      )}
    >
      <div className="h-3 rounded-sm bg-brand-blue" />
      {page === "home" && (
        <>
          {slot("HOME_TOP", "h-8")}
          <div className="flex flex-1 gap-1.5">
            <div className="flex flex-1 flex-col gap-1.5">
              {block("h-12")}
              {line("w-full")}
              {line("w-3/4")}
              {slot("HOME_MIDDLE", "h-6")}
              {block("h-8")}
              {line("w-2/3")}
            </div>
            {slot("HOME_SIDEBAR", "w-9")}
          </div>
        </>
      )}
      {page === "article" && (
        <>
          {line("w-11/12")}
          {line("w-2/3")}
          {slot("ARTICLE_TOP", "h-7")}
          {block("h-10")}
          {line("w-full")}
          {line("w-5/6")}
          {slot("ARTICLE_MIDDLE", "mx-auto h-9 w-3/4")}
          {line("w-full")}
          {line("w-4/5")}
          {slot("ARTICLE_BOTTOM", "h-7")}
        </>
      )}
      {page === "category" && (
        <>
          {line("w-1/2")}
          {slot("CATEGORY_TOP", "h-8")}
          <div className="grid grid-cols-2 gap-1.5">
            {block("h-10")}
            {block("h-10")}
            {block("h-10")}
            {block("h-10")}
          </div>
          {line("w-full")}
          {line("w-3/4")}
        </>
      )}
      {page === "mobile" && (
        <>
          {block("h-12")}
          {line("w-full")}
          {line("w-3/4")}
          {block("h-10")}
          {line("w-5/6")}
          <div className="flex-1" />
          {slot("MOBILE_STICKY", "h-5")}
        </>
      )}
    </div>
  );
}
