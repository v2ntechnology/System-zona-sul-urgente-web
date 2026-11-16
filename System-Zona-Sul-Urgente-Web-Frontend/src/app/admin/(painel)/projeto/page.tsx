import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { PanelEmpty } from "@/components/admin/panel";
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
  listSpecs,
  type ProjectDoc,
  projectPanelEnabled,
  readBacklog,
  readChangelog,
  readFrom,
  readHistory,
} from "@/lib/project/files";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/services/admin/admin-service";

export const metadata: Metadata = { title: "Projeto" };

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "board", label: "Board" },
  { key: "specs", label: "Specs" },
  { key: "changelog", label: "Changelog" },
  { key: "historico", label: "Commits" },
  { key: "documentos", label: "Documentos" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Área do desenvolvedor (como a do onPath e a do Resíduos): andamento do backlog, board, specs
// do Spec Kit, changelog, commits e documentos. Só em `next dev` e só para Administrador — lê
// arquivos do repositório na máquina; no servidor esta página não existe (404).
export default function ProjectPage({ searchParams }: PageProps<"/admin/projeto">) {
  // Fora do <Suspense>: no servidor é um 404 de verdade.
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
  const docHref = (key: string) => (doc: string) => href(key, `&doc=${encodeURIComponent(doc)}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">Projeto</h1>
        <p className="text-sm text-muted-foreground">
          Plano de desenvolvimento: backlog (docs/backlog.md), specs do Spec Kit, changelog e
          commits. Só aparece no ambiente de desenvolvimento.
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
      {tab === "specs" && (
        <Documents list={await listSpecs()} current={first(params.doc)} href={docHref("specs")} />
      )}
      {tab === "changelog" && <Changelog content={await readChangelog()} />}
      {tab === "historico" && <ProjectHistory commits={await readHistory()} />}
      {tab === "documentos" && (
        <Documents
          list={await listDocs()}
          current={first(params.doc)}
          href={docHref("documentos")}
        />
      )}
    </div>
  );
}

function Changelog({ content }: { content: string }) {
  if (!content) return <PanelEmpty>docs/changelog.md não encontrado.</PanelEmpty>;
  return (
    <article className="min-w-0 rounded-lg border bg-background p-4 shadow-xs sm:p-6">
      <Markdown content={content} />
    </article>
  );
}

async function Documents({
  list,
  current,
  href,
}: {
  list: ProjectDoc[];
  current?: string;
  href: (key: string) => string;
}) {
  const selected = await readFrom(list, current);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <DocList docs={list} active={selected?.doc.key} href={href} />
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
