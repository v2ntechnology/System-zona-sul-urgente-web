const DAY = 86_400_000;

const short = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "14/10 – 13/11", fração já decorrida (0–1) e texto de quanto falta. */
export function campaignPeriod(startsAt: string, endsAt: string, now: number) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const daysToStart = Math.ceil((start - now) / DAY);
  const daysLeft = Math.ceil((end - now) / DAY);
  const hint =
    now < start
      ? daysToStart === 1
        ? "começa amanhã"
        : `começa em ${daysToStart} dias`
      : now > end
        ? "terminou"
        : daysLeft <= 1
          ? "termina hoje"
          : `faltam ${daysLeft} dias`;
  return {
    range: `${short.format(new Date(start))} – ${short.format(new Date(end))}`,
    elapsed,
    hint,
    endingSoon: now <= end && daysLeft <= 7,
  };
}

/** Mesmo cálculo, com o relógio de agora (páginas do servidor, a cada requisição). */
export function campaignPeriodNow(startsAt: string, endsAt: string) {
  return campaignPeriod(startsAt, endsAt, Date.now());
}
