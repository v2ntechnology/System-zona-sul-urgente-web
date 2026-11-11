import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { Markdown } from "@/components/admin/project/markdown";
import {
  DocList,
  ProjectBoard,
  ProjectHistory,
  ProjectOverview,
} from "@/components/admin/project/project-views";
import { adminRoutes } from "@/config/admin-navigation";
import { parseBacklog } from "@/lib/project/backlog";
import {
  listDocs,
  projectPanelEnabled,
  readBacklog,
  readDoc,
  readHistory,
} from "@/lib/project/files";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/services/admin/admin-service";

export const metadata: Metadata = { title: "Projeto" };

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "board", label: "Board" },
  { key: "historico", label: "Histórico" },
  { key: "documentos", label: "Documentos" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Painel do projeto (como o do onPath): andamento do backlog, board, histórico do git e os
// documentos de doc/. Só em `next dev` e só para Administrador — doc/ não vai para o git, então
// no servidor esta página não existe (404).
export default function ProjectPage({ searchParams }: PageProps<"/admin/projeto">) {
  // Fora do <Suspense>: no servidor (sem doc/) é um 404 de verdade.
  if (!projectPanelEnabled) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] rounded-xl" />}>
      <Project searchParams={searchParams} />
    </Suspense>
  );
}

async function Project({ searchParams }: Pick<PageProps<"/admin/projeto">, "searchParams">) {
  await connection();
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") notFound();

  const params = await searchParams;
  const raw = first(params.aba);
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "visao";
  const href = (key: string, extra = "") => `${adminRoutes.project}?aba=${key}${extra}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">Projeto</h1>
        <p className="text-sm text-muted-foreground">
          Plano de desenvolvimento: o que já foi feito e o que falta, lido do doc/BACKLOG.md. Só
          aparece no ambiente de desenvolvimento.
        </p>
      </div>
      <FilterTabs
        label="Seções do projeto"
        variant="underline"
        active={tab}
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: href(t.key) }))}
      />
      {tab === "visao" && <ProjectOverview items={parseBacklog(await readBacklog())} />}
      {tab === "board" && <ProjectBoard items={parseBacklog(await readBacklog())} />}
      {tab === "historico" && <ProjectHistory commits={await readHistory()} />}
      {tab === "documentos" && <Documents current={first(params.doc)} href={href} />}
    </div>
  );
}

async function Documents({
  current,
  href,
}: {
  current?: string;
  href: (key: string, extra?: string) => string;
}) {
  const docs = await listDocs();
  const selected = await readDoc(current ?? "BACKLOG");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <DocList
        docs={docs}
        active={selected?.doc.key}
        href={(key) => href("documentos", `&doc=${encodeURIComponent(key)}`)}
      />
      <article className="min-w-0 rounded-lg border bg-background p-4 shadow-xs sm:p-6">
        {selected ? (
          <Markdown content={selected.content} />
        ) : (
          <p className="text-muted-foreground">Documento não encontrado.</p>
        )}
      </article>
    </div>
  );
}
