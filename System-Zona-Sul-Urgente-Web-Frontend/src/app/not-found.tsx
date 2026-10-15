import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">
        O conteúdo que você procura não existe ou foi removido.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Voltar para a página inicial
      </Link>
    </main>
  );
}
