"use client";

import { useEffect, useState } from "react";

import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

// O servidor renderiza data e hora fixas (cacheável); no navegador vira "há 12 min"
// e se atualiza a cada minuto. Sem JavaScript, a data absoluta continua correta.
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => formatDateTime(iso));

  useEffect(() => {
    const update = () => setLabel(formatRelative(iso, Date.now()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={cn("tabular-nums", className)}>
      {label}
    </time>
  );
}
