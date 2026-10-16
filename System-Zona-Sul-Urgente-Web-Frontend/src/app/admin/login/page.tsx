import type { Metadata } from "next";

import { AuthScreen } from "@/components/admin/login/auth-screen";
import { LoginForm } from "@/components/admin/login/login-form";

export const metadata: Metadata = { title: "Entrar" };

// Login do painel. Autenticação real pela API (BE-006: sessão, 2FA, bloqueio por
// tentativas) via Server Actions.
export default function LoginPage() {
  return (
    <AuthScreen>
      <LoginForm />
    </AuthScreen>
  );
}
