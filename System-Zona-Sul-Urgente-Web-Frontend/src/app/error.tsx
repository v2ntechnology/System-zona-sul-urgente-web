"use client";

import { ArrowLeftIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { StatusPage, statusAction, statusSecondaryAction } from "@/components/layout/status-page";
import { routes } from "@/config/navigation";

// Erro inesperado (Next 16: a prop de tentar de novo é `retry`). Em produção a mensagem vem
// genérica; o `digest` liga a tela ao log do servidor.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      standalone
      mood="error"
      title="Eita! Algo deu errado por aqui"
      description={
        <>
          Tivemos um problema para mostrar esta página. Tente de novo em instantes.
          {error.digest && (
            <span className="mt-2 block text-xs">
              Código para o suporte: <code>{error.digest}</code>
            </span>
          )}
        </>
      }
    >
      <button type="button" onClick={() => retry()} className={statusAction}>
        <RotateCwIcon aria-hidden className="size-4" /> Tentar de novo
      </button>
      <Link href={routes.home} className={statusSecondaryAction}>
        <ArrowLeftIcon aria-hidden className="size-4" /> Página inicial
      </Link>
    </StatusPage>
  );
}
