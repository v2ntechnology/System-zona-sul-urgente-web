import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Zona Sul Urgente" },
  robots: { index: false, follow: false },
};

// Sem login ainda (BE-006), o painel NÃO pode ir ao ar aberto: em produção só aparece
// com ADMIN_PREVIEW=true NO BUILD (ex.: staging protegido por Cloudflare Access). Senão, 404.
// O valor é fixado no build pelo next.config (env), igual para todas as páginas do painel.
const adminEnabled = process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW === "true";

// Raiz do painel: só o bloqueio. A navegação fica em (painel)/layout.tsx, para a tela de
// login (/admin/login) ficar fora dela.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  if (!adminEnabled) notFound();
  return children;
}
