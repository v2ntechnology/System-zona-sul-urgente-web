import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto das telas do painel enquanto os dados carregam (o admin não depende de SEO).
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
