import { RemoteImage } from "@/components/media/remote-image";

import { cn } from "@/lib/utils";
import type { Columnist } from "@/types/news";

// Foto redonda do colunista com aro vermelho (estilo CNN "Blogs e colunas"). Sem foto
// cadastrada, mostra as iniciais.
export function ColumnistAvatar({
  columnist,
  size = "md",
  className,
}: {
  columnist: Columnist;
  size?: "md" | "lg";
  className?: string;
}) {
  const initials = columnist.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue font-heading font-bold text-white ring-2 ring-brand-red ring-offset-2 ring-offset-background",
        size === "md" ? "size-16 text-lg sm:size-20 sm:text-xl" : "size-24 text-3xl sm:size-28",
        className,
      )}
    >
      {columnist.photo ? (
        <RemoteImage
          src={columnist.photo.url}
          alt=""
          fill
          sizes={size === "md" ? "80px" : "112px"}
          className="object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}
