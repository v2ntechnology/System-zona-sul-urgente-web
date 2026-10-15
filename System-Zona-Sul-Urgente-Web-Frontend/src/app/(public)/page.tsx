import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

// Home provisória. A estrutura real (urgente, destaques, últimas, mais lidas,
// slots de publicidade) entra no FE-101.
export default function HomePage() {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold tracking-tight">{siteConfig.name}</h1>
      <p className="max-w-prose text-muted-foreground">{siteConfig.description}</p>
      <Button>Em construção</Button>
    </section>
  );
}
