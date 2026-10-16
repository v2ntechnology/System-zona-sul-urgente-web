import { SectionsProvider } from "@/components/layout/sections-context";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSiteSections } from "@/services/taxonomy-service";

// Layout do portal público. O admin tem layout próprio em app/admin.
// A largura fica com cada página (<Container>), para permitir faixas de ponta a ponta.
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  // Menu montado a partir das editorias cadastradas no painel (FE-158).
  const sections = await getSiteSections();
  return (
    <SectionsProvider sections={sections}>
      <SiteHeader />
      <main id="conteudo" className="flex-1 py-8">
        {children}
      </main>
      <SiteFooter sections={sections} />
    </SectionsProvider>
  );
}
