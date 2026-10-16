import type { Metadata } from "next";

import { AuthorsManager } from "@/components/admin/team/authors-manager";
import { listAuthorProfiles } from "@/services/admin/team-service";

export const metadata: Metadata = { title: "Autores" };

export default async function AuthorsPage() {
  return <AuthorsManager initial={await listAuthorProfiles()} />;
}
