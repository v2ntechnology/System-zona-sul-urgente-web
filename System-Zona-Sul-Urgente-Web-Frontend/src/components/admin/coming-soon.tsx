import { ConstructionIcon } from "lucide-react";

// Tela provisória das áreas do painel ainda não construídas.
export function ComingSoon({ title, item }: { title: string; item: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background px-4 py-16 text-center">
        <ConstructionIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-semibold">Em construção</p>
        <p className="text-sm text-muted-foreground">Esta área entra no item {item} do backlog.</p>
      </div>
    </div>
  );
}
