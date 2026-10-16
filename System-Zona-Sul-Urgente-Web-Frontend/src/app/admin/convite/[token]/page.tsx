import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AcceptInviteForm } from "@/components/admin/login/accept-invite-form";
import { AuthScreen } from "@/components/admin/login/auth-screen";
import { adminRoutes } from "@/config/admin-navigation";
import { authApi } from "@/services/admin/auth-api";

export const metadata: Metadata = { title: "Convite" };

// Aceite do convite da equipe (FE-159): o administrador manda o link; a pessoa confere o
// nome e cria a senha. O token só vale uma vez e por 7 dias.
export default function InvitePage({ params }: PageProps<"/admin/convite/[token]">) {
  return (
    <AuthScreen>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Conferindo o convite…</p>}>
        <InviteStep params={params} />
      </Suspense>
    </AuthScreen>
  );
}

async function InviteStep({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await authApi.checkInvite(token);
  if (!invite.ok) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold">Convite indisponível</h1>
        <p className="text-sm text-muted-foreground">{invite.message}</p>
        <Link
          href={adminRoutes.login}
          className="text-sm font-semibold text-brand-blue hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    );
  }
  return <AcceptInviteForm token={token} name={invite.data.name} email={invite.data.email} />;
}
