import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import {
  allSections,
  institutional,
  neighborhoods,
  type NavItem,
  routes,
} from "@/config/navigation";
import { siteConfig } from "@/config/site";

// Rodapé (FE-007): editorias, bairros, institucional e redes. Fundo azul-escuro (branco: 10,8:1).
export function SiteFooter() {
  return (
    <footer className="mt-12 bg-brand-blue-dark text-white">
      <div className="mx-auto grid max-w-site gap-10 px-4 py-10 md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col items-start gap-4">
          <BrandLogo variant="light" className="text-xs" />
          <p className="max-w-xs text-sm text-white/80">{siteConfig.description}</p>
          <div className="flex flex-col gap-1 text-sm">
            <a
              href={siteConfig.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline focus-visible:outline-white"
            >
              Instagram @zonasulurgente
            </a>
            <a
              href={routes.feed()}
              className="font-medium hover:underline focus-visible:outline-white"
            >
              RSS
            </a>
            {siteConfig.whatsappUrl && (
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline focus-visible:outline-white"
              >
                Canal no WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Celular: Editorias e Institucional lado a lado, Bairros em 2 colunas abaixo. */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-[1fr_2fr_1fr]">
          <FooterGroup title="Editorias" items={allSections} />
          <FooterGroup
            title="Bairros"
            items={neighborhoods}
            className="order-last col-span-2 sm:order-none sm:col-span-1"
            columns
          />
          <FooterGroup title="Institucional" items={institutional} />
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-site px-4 py-4 text-xs text-white/70">
          © {siteConfig.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

type FooterGroupProps = {
  title: string;
  items: NavItem[];
  className?: string;
  columns?: boolean;
};

function FooterGroup({ title, items, className, columns }: FooterGroupProps) {
  return (
    <nav aria-label={title} className={className}>
      <h2 className="mb-3 text-label font-bold text-white/70 uppercase">{title}</h2>
      <ul
        className={
          columns ? "grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm" : "flex flex-col gap-1.5 text-sm"
        }
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="hover:underline focus-visible:outline-white">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
