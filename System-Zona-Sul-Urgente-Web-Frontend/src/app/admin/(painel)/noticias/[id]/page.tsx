import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { loadEditorProps } from "@/components/admin/editor/editor-props";
import { NewsEditor } from "@/components/admin/editor/news-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getDraftForEdit } from "@/services/admin/news-editor-service";

export const metadata: Metadata = { title: "Editar notícia" };

// O id vem da URL: o carregamento fica em <Suspense> (rota dinâmica do painel).
export default function EditNewsPage({ params }: PageProps<"/admin/noticias/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] rounded-lg" />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: { params: PageProps<"/admin/noticias/[id]">["params"] }) {
  const { id } = await params;
  const [draft, { options, permissions }] = await Promise.all([
    getDraftForEdit(id),
    loadEditorProps(),
  ]);
  if (!draft) notFound();
  return <NewsEditor key={id} initial={draft} options={options} permissions={permissions} />;
}
