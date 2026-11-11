import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { StatusPage, statusAction, statusSecondaryAction } from "@/components/layout/status-page";
import { routes } from "@/config/navigation";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      mood="lost"
      title="Ops! Essa notícia sumiu do mapa"
      description="O endereço não existe ou o conteúdo foi removido. Que tal voltar para as últimas da Zona Sul?"
    >
      <Link href={routes.home} className={statusAction}>
        <ArrowLeftIcon aria-hidden className="size-4" /> Voltar para a página inicial
      </Link>
      <Link href={routes.search} className={statusSecondaryAction}>
        <SearchIcon aria-hidden className="size-4" /> Buscar notícias
      </Link>
    </StatusPage>
  );
}
