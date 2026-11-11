// Histórico do painel do projeto: o `git log` agrupado pelos tipos dos Conventional Commits
// (prefixo em inglês, descrição em português — regra 3 do projeto).

export type CommitKind = "added" | "fixed" | "changed" | "docs" | "chore";

export type Commit = {
  hash: string;
  date: string;
  kind: CommitKind;
  scope?: string;
  message: string;
};

export const KIND_LABELS: Record<CommitKind, string> = {
  added: "Adicionado",
  fixed: "Corrigido",
  changed: "Alterado",
  docs: "Documentação",
  chore: "Manutenção",
};

const KIND_BY_TYPE: Record<string, CommitKind> = {
  feat: "added",
  fix: "fixed",
  refactor: "changed",
  perf: "changed",
  style: "changed",
  revert: "changed",
  docs: "docs",
  test: "chore",
  build: "chore",
  ci: "chore",
  chore: "chore",
};

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?: (.+)$/;

/** Linha do `git log --pretty=%H%x1f%aI%x1f%s` (campos separados pelo caractere 0x1f). */
export function parseCommitLine(line: string): Commit | null {
  const [hash, date, subject] = line.split("\x1f");
  if (!hash || !date || subject === undefined) return null;
  const match = CONVENTIONAL.exec(subject);
  if (!match) return { hash, date, kind: "chore", message: subject };
  return {
    hash,
    date,
    kind: KIND_BY_TYPE[match[1]] ?? "chore",
    scope: match[2],
    message: match[3],
  };
}

/** Agrupa por dia (horário de Brasília), mais recentes primeiro. */
export function groupByDay(commits: Commit[]): [string, Commit[]][] {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const groups = new Map<string, Commit[]>();
  for (const commit of commits) {
    const key = day.format(new Date(commit.date));
    groups.set(key, [...(groups.get(key) ?? []), commit]);
  }
  return [...groups.entries()];
}
