import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookies";

// Porteiro do painel (BE-006). Com a API configurada, quem abre /admin sem o cookie de
// sessão vai direto para o login (com ?next= para voltar). É só um atalho: a validação de
// verdade (sessão vencida, revogada, permissão) acontece na API a cada pedido.
export function proxy(request: NextRequest) {
  if (!process.env.API_URL) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  // Login e aceite de convite são as únicas telas do painel abertas sem sessão.
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/convite/") ||
    request.cookies.has(SESSION_COOKIE)
  ) {
    return NextResponse.next();
  }
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
