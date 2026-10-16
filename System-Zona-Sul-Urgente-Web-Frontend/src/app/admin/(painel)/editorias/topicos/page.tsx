import type { Metadata } from "next";

import { TagsManager } from "@/components/admin/taxonomy/tags-manager";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { listTagsAdmin } from "@/services/admin/taxonomy-admin-service";

export const metadata: Metadata = { title: "Tópicos" };

export default async function TagsPage() {
  const [user, tags] = await Promise.all([getCurrentUser(), listTagsAdmin()]);
  return (
    <TagsManager
      initial={tags.map((t) => ({ ...t, active: t.active ?? true }))}
      canCreate={can(user.role, "tags.manage")}
    />
  );
}
