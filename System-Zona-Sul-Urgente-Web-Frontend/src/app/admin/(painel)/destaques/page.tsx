import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeFeaturedEditor } from "@/components/admin/home-featured-editor";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { getHomeFeatured } from "@/services/admin/home-featured-service";

export const metadata: Metadata = { title: "Destaques da home" };

// Destaques da home (spec 003): só quem publica (Editor e Administrador) escolhe a manchete e os
// destaques. A API confere a permissão de novo a cada ação.
export default async function HomeFeaturedPage() {
  const user = await getCurrentUser();
  if (!can(user.role, "news.publish")) notFound();
  const featured = await getHomeFeatured();
  if (!featured) notFound();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">Destaques da home</h1>
        <p className="text-sm text-muted-foreground">
          O que abre o site: manchete, 2 destaques ao lado e a faixa logo abaixo. Sem manchete
          escolhida, a home usa a notícia publicada mais recente (nunca uma patrocinada).
        </p>
      </div>
      <HomeFeaturedEditor initial={featured} />
    </div>
  );
}
