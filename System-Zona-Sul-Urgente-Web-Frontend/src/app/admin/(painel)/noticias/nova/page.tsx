import type { Metadata } from "next";

import { loadEditorProps } from "@/components/admin/editor/editor-props";
import { NewsEditor } from "@/components/admin/editor/news-editor";
import { emptyDraft } from "@/lib/editor/validate";

export const metadata: Metadata = { title: "Nova notícia" };

export default async function NewNewsPage() {
  const { options, permissions } = await loadEditorProps();
  return <NewsEditor initial={emptyDraft()} options={options} permissions={permissions} />;
}
