import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Layout do portal público. O admin tem layout próprio em app/admin.
// A largura fica com cada página (<Container>), para permitir faixas de ponta a ponta.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1 py-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
