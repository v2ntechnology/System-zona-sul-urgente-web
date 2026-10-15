import type { Metadata } from "next";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Kicker, SponsoredBadge, UrgentBadge } from "@/components/news/news-badges";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Design system" };

// Vitrine interna dos tokens (FE-005). Serve para validar a direção visual
// e conferir contraste antes de construir as telas reais.

const palette = [
  { name: "Azul", token: "brand-blue", hex: "#024BAA", className: "bg-brand-blue" },
  {
    name: "Azul escuro",
    token: "brand-blue-dark",
    hex: "#013A85",
    className: "bg-brand-blue-dark",
  },
  { name: "Vermelho (logo)", token: "brand-red", hex: "#FD3132", className: "bg-brand-red" },
  {
    name: "Vermelho (texto)",
    token: "brand-red-dark",
    hex: "#D91F26",
    className: "bg-brand-red-dark",
  },
  { name: "Azul-claro", token: "brand-sky", hex: "#38B8FF", className: "bg-brand-sky" },
  {
    name: "Azul-claro suave",
    token: "brand-sky-light",
    hex: "#E3F4FF",
    className: "bg-brand-sky-light",
  },
  { name: "Texto", token: "foreground", hex: "#111111", className: "bg-foreground" },
  {
    name: "Texto secundário",
    token: "muted-foreground",
    hex: "#5B6577",
    className: "bg-muted-foreground",
  },
  { name: "Fundo neutro", token: "muted", hex: "#F2F4F7", className: "bg-muted" },
  { name: "Borda", token: "border", hex: "#E3E6EB", className: "bg-border" },
];

const typeScale = [
  {
    token: "text-display",
    sample: "Manchete principal da home",
    className: "text-display font-heading font-bold",
  },
  {
    token: "text-headline",
    sample: "Título de destaque secundário",
    className: "text-headline font-heading font-bold",
  },
  {
    token: "text-title",
    sample: "Título de card ou de seção",
    className: "text-title font-heading font-bold",
  },
  {
    token: "text-teaser",
    sample: "Título de card compacto em listas e grades",
    className: "text-teaser font-heading font-bold",
  },
  {
    token: "text-article",
    sample: "Corpo da matéria, otimizado para leitura longa no celular e no desktop.",
    className: "text-article",
  },
  {
    token: "text-label",
    sample: "Chapéu / selo",
    className: "text-label font-bold uppercase",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <h2 className="text-title">{title}</h2>
      {children}
    </section>
  );
}

function ImagePlaceholder({ className }: { className?: string }) {
  return <div className={`aspect-video w-full bg-muted ${className ?? ""}`} />;
}

export default function DesignSystemPage() {
  return (
    <div className="flex max-w-site flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-headline">Design system</h1>
        <p className="text-muted-foreground">
          Tokens em <code>src/app/globals.css</code>. Componentes usam só tokens semânticos.
        </p>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-6">
          <div className="bg-masthead p-4">
            <BrandLogo className="text-sm" />
          </div>
          <div className="border p-4">
            <BrandLogo variant="light" className="text-sm" />
          </div>
          <div className="border p-4">
            <BrandLogo variant="light" className="text-xl" />
          </div>
          <BrandLogo variant="badge" className="text-[0.6rem]" />
        </div>
      </Section>

      <Section title="Cores">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {palette.map((color) => (
            <div key={color.token} className="flex flex-col gap-2">
              <div className={`h-16 border ${color.className}`} />
              <div className="text-sm">
                <div className="font-semibold">{color.name}</div>
                <div className="text-muted-foreground">
                  {color.token} · {color.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <p className="text-sm text-muted-foreground">
          Logo: Montserrat ExtraBold · Títulos: Archivo semicondensada · Texto: Inter
        </p>
        <div className="flex flex-col gap-4">
          {typeScale.map((item) => (
            <div key={item.token} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline">
              <code className="text-xs text-muted-foreground">{item.token}</code>
              <span className={item.className}>{item.sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Selos e botões">
        <div className="flex flex-wrap items-center gap-3">
          <UrgentBadge />
          <UrgentBadge>Ao vivo</UrgentBadge>
          <SponsoredBadge />
          <Kicker>Segurança</Kicker>
          <Kicker>Trânsito</Kicker>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Excluir</Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </Section>

      <Section title="Exemplo de home (estrutura CNN)">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <article className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <UrgentBadge />
              <Kicker>Copacabana</Kicker>
            </div>
            <h3 className="text-display">
              Temporal alaga ruas de Copacabana e Botafogo; Defesa Civil emite alerta
            </h3>
            <ul className="flex flex-col gap-1.5">
              {[
                "Veja quais vias estão interditadas agora",
                "Previsão indica chuva forte até a madrugada",
                "Como receber alertas da Defesa Civil no celular",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 bg-kicker" />
                  <a href="#" className="hover:underline">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <aside className="flex flex-col gap-3 bg-muted p-4">
            <h3 className="text-title text-brand-blue">Mais lidas</h3>
            <ol className="flex flex-col divide-y">
              {[
                "Ciclista é assaltado na orla do Leblon",
                "Obra fecha faixa do Túnel Rebouças",
                "Feira da Glória muda de endereço",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 py-3">
                  <span className="font-heading text-headline leading-none text-brand-red">
                    {index + 1}
                  </span>
                  <a href="#" className="font-heading text-teaser font-bold hover:underline">
                    {item}
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              kicker: "Trânsito",
              title: "Aterro do Flamengo terá interdição no domingo para evento",
            },
            { kicker: "Cidade", title: "Prefeitura anuncia reforma da Praça General Osório" },
            {
              kicker: "Gastronomia",
              title: "Novo restaurante em Botafogo aposta em comida nordestina",
              sponsored: true,
            },
          ].map((card) => (
            <article key={card.title} className="flex flex-col gap-2">
              <div className="relative">
                <ImagePlaceholder />
                <span aria-hidden className="absolute top-0 left-0 h-1 w-8 bg-brand-red" />
              </div>
              <div className="flex items-center gap-2">
                {card.sponsored ? <SponsoredBadge /> : <Kicker>{card.kicker}</Kicker>}
              </div>
              <h3 className="text-title">{card.title}</h3>
            </article>
          ))}
        </div>

        <div
          aria-label="Espaço publicitário"
          className="flex h-28 items-center justify-center bg-ad-slot text-xs tracking-widest text-muted-foreground uppercase"
        >
          Publicidade · HOME_MIDDLE
        </div>
      </Section>
    </div>
  );
}
