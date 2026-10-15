"use client";

import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { NewsSummary } from "@/types/news";

type Lists = { day: NewsSummary[]; week: NewsSummary[]; all: NewsSummary[] };

const periods = [
  { value: "day", label: "24 horas" },
  { value: "week", label: "Semana" },
  { value: "all", label: "Geral" },
] as const;

export function MostReadTabs({ lists, className }: { lists: Lists; className?: string }) {
  return (
    <section aria-labelledby="mais-lidas" className={cn("bg-muted p-5", className)}>
      <h2 id="mais-lidas" className="mb-3 flex items-center gap-3 text-title text-brand-blue">
        <span aria-hidden className="h-[0.9em] w-1.5 bg-brand-red" />
        Mais lidas
      </h2>
      <Tabs defaultValue="day">
        <TabsList variant="line" className="w-full justify-start border-b">
          {periods.map((period) => (
            <TabsTrigger
              key={period.value}
              value={period.value}
              className="flex-none rounded-none px-2 data-active:text-brand-blue data-active:after:absolute data-active:after:inset-x-0 data-active:after:-bottom-px data-active:after:h-0.5 data-active:after:bg-brand-red"
            >
              {period.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {periods.map((period) => (
          <TabsContent key={period.value} value={period.value}>
            <ol className="flex flex-col divide-y divide-border">
              {lists[period.value].map((news, index) => (
                <li key={news.id} className="group relative flex gap-4 py-3">
                  <span
                    aria-hidden
                    className="w-7 shrink-0 font-heading text-headline leading-none text-brand-red tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <Link
                    href={routes.news(news)}
                    className="font-heading text-teaser font-bold group-hover:text-brand-blue"
                  >
                    {news.title}
                  </Link>
                </li>
              ))}
            </ol>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
