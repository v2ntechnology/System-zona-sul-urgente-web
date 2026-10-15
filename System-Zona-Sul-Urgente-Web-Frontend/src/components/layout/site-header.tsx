import { BrandLogo } from "@/components/brand/brand-logo";

// Header provisório: barra marinho com o logo, na linha da CNN (barra escura + bloco
// vermelho). Navegação, busca, menu mobile e faixa de urgente entram no FE-007.
export function SiteHeader() {
  return (
    <header className="bg-masthead text-masthead-foreground">
      <div className="mx-auto flex max-w-site items-center px-4 py-3">
        <BrandLogo className="text-sm" />
      </div>
    </header>
  );
}
