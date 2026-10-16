import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamManager } from "@/components/admin/team/team-manager";
import { adminRoutes } from "@/config/admin-navigation";
import { can } from "@/config/permissions";
import { getCurrentUser } from "@/services/admin/admin-service";
import { listAuthorProfiles, listTeam } from "@/services/admin/team-service";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage() {
  const [user, team, authors] = await Promise.all([
    getCurrentUser(),
    listTeam(),
    listAuthorProfiles(),
  ]);
  // Editor cuida só dos autores.
  if (!can(user.role, "users.manage")) redirect(adminRoutes.authors);
  return (
    <TeamManager initial={team} currentUserId={user.id} authorSlugs={authors.map((a) => a.slug)} />
  );
}
