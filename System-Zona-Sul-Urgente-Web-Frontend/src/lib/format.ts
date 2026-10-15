// Datas sempre no fuso do Rio, independentemente de onde o servidor roda.
const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const longDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "15 de out., 14:32" — usado no HTML do servidor (estável, sem depender de "agora"). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace(/\s+/g, " ");
}

/** "15 de outubro de 2026 às 14:32" — página da matéria. */
export function formatLongDateTime(iso: string): string {
  return longDateTime.format(new Date(iso));
}

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: TIME_ZONE,
});

/** "15/10/26 às 14:30" — cabeçalho da matéria (padrão CNN). */
export function formatShortDateTime(iso: string): string {
  return `${shortDate.format(new Date(iso))} às ${time.format(new Date(iso))}`;
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/**
 * "agora", "há 12 min", "há 3 h"; acima de 24 h (ou data futura) volta para data e hora.
 * Depende do relógio do leitor, por isso só roda no cliente (ver RelativeTime).
 */
export function formatRelative(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 0 || minutes >= 24 * 60) return formatDateTime(iso);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h`;
}
