import type { Metadata } from "next";

import { loadEditorProps } from "@/components/admin/editor/editor-props";
import { NewsEditor } from "@/components/admin/editor/news-editor";
import { emptyDraft } from "@/lib/editor/validate";

export const metadata: Metadata = { title: "Nova notícia" };

export default async function NewNewsPage() {
  const { options, permissions, defaultAuthorSlug } = await loadEditorProps();
  const initial = {
    ...emptyDraft(),
    authorSlugs: defaultAuthorSlug ? [defaultAuthorSlug] : [],
  };
  return <NewsEditor initial={initial} options={options} permissions={permissions} />;
}
