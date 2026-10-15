import { ArrowRightIcon, MessageCircleIcon } from "lucide-react";
import Image from "next/image";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/news";

// Chamadas para seguir o portal fora do site, no mesmo formato da CNN: cartão branco com
// borda colorida, ícone, texto e botão. WhatsApp em verde (cor que o leitor reconhece);
// Google com a borda vermelha da marca.

function FollowCard({
  className,
  borderClassName,
  icon,
  text,
  action,
}: {
  className?: string;
  borderClassName: string;
  icon: React.ReactNode;
  text: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-lg border-2 bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-5",
        borderClassName,
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {icon}
        <p className="font-heading text-teaser font-bold sm:text-title">{text}</p>
      </div>
      <div className="sm:ml-auto">{action}</div>
    </aside>
  );
}

const actionButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold whitespace-nowrap transition hover:-translate-y-px hover:shadow-md motion-reduce:transition-none sm:w-auto";

type WhatsAppCtaProps = {
  /** Editoria da chamada; sem ela, chamada geral do portal. */
  category?: Pick<Category, "name" | "whatsappUrl">;
  className?: string;
};

/** Canal de WhatsApp da editoria; depois o canal geral; sem nenhum, não renderiza. */
export function WhatsAppCta({ category, className }: WhatsAppCtaProps) {
  const href = category?.whatsappUrl ?? siteConfig.whatsappUrl;
  if (!href) return null;
  const topic = category ? `de ${category.name}` : "da Zona Sul";

  return (
    <FollowCard
      className={className}
      borderClassName="border-whatsapp/40"
      icon={
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white">
          <MessageCircleIcon aria-hidden className="size-6" />
        </span>
      }
      text={<>Acompanhe as notícias {topic} no canal do WhatsApp</>}
      action={
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(actionButton, "bg-whatsapp text-white")}
        >
          Entrar no canal
          <ArrowRightIcon aria-hidden className="size-4" />
        </a>
      }
    />
  );
}

/** "Siga no Google": recurso de fontes preferidas do Google (o mesmo link usado pela CNN). */
export function GoogleFollowCta({ className }: { className?: string }) {
  const host = new URL(siteConfig.url).host;
  return (
    <FollowCard
      className={className}
      borderClassName="border-brand-red/70"
      icon={
        <Image
          src="/brand/logo-512.png"
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-md"
          unoptimized
        />
      }
      text={<>Siga o {siteConfig.name} no Google e receba as principais notícias da Zona Sul</>}
      action={
        <a
          href={`https://www.google.com/preferences/source?q=${encodeURIComponent(host)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(actionButton, "border bg-muted text-foreground hover:bg-accent")}
        >
          <GoogleG />
          Seguir no Google
        </a>
      }
    />
  );
}

// "G" oficial do Google (cores de marca de terceiros, exigidas pelas diretrizes deles;
// por isso ficam fora dos tokens do projeto).
function GoogleG() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
