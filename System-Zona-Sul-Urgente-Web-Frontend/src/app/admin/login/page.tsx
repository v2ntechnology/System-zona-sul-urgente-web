import type { Metadata } from "next";
import Image from "next/image";

import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginForm } from "@/components/admin/login/login-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Foto de fundo do login. PROVISÓRIA: o Vinicius vai mandar uma foto da Zona Sul
 * (acervo do jornal). Ao receber, salvar em /public/login/ e trocar aqui.
 */
const LOGIN_PHOTO = {
  src: "https://picsum.photos/seed/zona-sul-orla/1920/1280",
  credit: "Foto ilustrativa",
};

// Login do painel (decisão 2026-10-15): foto da Zona Sul de fundo e cartão branco.
// Autenticação real pela API (BE-006: sessão, 2FA, bloqueio por tentativas) via Server Actions.
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-1 items-center bg-brand-blue-dark px-4 py-10 sm:px-10 lg:px-20">
      <Image
        src={LOGIN_PHOTO.src}
        alt=""
        fill
        preload
        loading="eager"
        sizes="100vw"
        className="object-cover"
      />
      {/* Escurece a foto para o texto branco e o cartão terem contraste. */}
      <div aria-hidden className="absolute inset-0 bg-brand-blue-dark/55" />

      <main id="conteudo" className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl bg-background p-6 shadow-2xl sm:p-9">
          <BrandLogo variant="masthead" className="mb-8 text-[0.7rem]" asLink={false} />
          <LoginForm />
        </div>
      </main>

      <div className="absolute right-6 bottom-6 z-10 hidden max-w-sm text-right text-white lg:block">
        <p className="font-heading text-3xl leading-tight font-bold">
          Notícias da Zona Sul,
          <br />
          <span className="text-brand-sky">em tempo real.</span>
        </p>
        <p className="mt-2 text-xs text-white/70">{LOGIN_PHOTO.credit}</p>
      </div>
    </div>
  );
}
