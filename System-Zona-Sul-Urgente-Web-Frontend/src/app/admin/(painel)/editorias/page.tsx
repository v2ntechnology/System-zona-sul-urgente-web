import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/admin/taxonomy/categories-manager";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { listCategoriesAdmin } from "@/services/admin/taxonomy-admin-service";

export const metadata: Metadata = { title: "Editorias" };

export default async function CategoriesPage() {
  const [user, categories] = await Promise.all([getCurrentUser(), listCategoriesAdmin()]);
  // Repórter não gerencia editorias: vai direto para os tópicos.
  if (!can(user.role, "taxonomy.manage")) redirect(adminRoutes.tags);
  return (
    <CategoriesManager
      initial={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentSlug: c.parent?.slug,
        color: c.color,
        inBar: Boolean(c.inBar),
        active: c.active !== false,
        order: c.order ?? 999,
        whatsappUrl: c.whatsappUrl ?? "",
        description: c.description ?? "",
        newsCount: c.newsCount,
      }))}
    />
  );
}
