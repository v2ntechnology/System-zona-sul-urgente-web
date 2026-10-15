import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto exibido enquanto a home (ou outra página pública) carrega dados.
export default function Loading() {
  return (
    <Container aria-busy="true" aria-label="Carregando notícias" className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-video w-full rounded-none" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="aspect-video w-28 shrink-0 rounded-none" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
