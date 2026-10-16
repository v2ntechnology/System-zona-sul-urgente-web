import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Zona Sul Urgente" },
  robots: { index: false, follow: false },
};

// Em produção o painel só existe com login de verdade (API_URL: BE-006, sessão + 2FA) ou,
// sem API, com ADMIN_PREVIEW=true (modo demonstração, só em ambiente protegido, ex.: staging
// atrás do Cloudflare Access). Senão, 404. Os dois valores são lidos NO BUILD.
const adminEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.ADMIN_PREVIEW === "true" ||
  Boolean(process.env.API_URL);

// Raiz do painel: só o bloqueio. A navegação fica em (painel)/layout.tsx, para a tela de
// login (/admin/login) ficar fora dela.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  if (!adminEnabled) notFound();
  return children;
}
