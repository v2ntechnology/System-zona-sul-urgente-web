import { MicMascot } from "@/components/brand/mic-mascot";

// Tela provisória das áreas do painel ainda não construídas (mascote de capacete).
export function ComingSoon({ title, item }: { title: string; item: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-linear-to-b from-brand-sky-light to-background px-4 py-12 text-center">
        <MicMascot mood="building" className="w-36" />
        <p className="font-heading text-lg font-bold">Em construção</p>
        <p className="text-sm text-muted-foreground">Esta área entra no item {item} do backlog.</p>
      </div>
    </div>
  );
}
