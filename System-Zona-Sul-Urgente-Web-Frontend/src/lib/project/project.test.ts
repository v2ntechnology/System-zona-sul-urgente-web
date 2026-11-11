import { describe, expect, it } from "vitest";

import { groupOf, parseBacklog, progressOf, statusOf } from "@/lib/project/backlog";
import { groupByDay, parseCommitLine } from "@/lib/project/history";

const BACKLOG = `# FASE 0 — FUNDAÇÃO

## FE-001 — Criar repositório e estrutura inicial
**Prioridade:** P0
**Status:** Done (2026-10-15), exceto a proteção da \`main\`

## FE-006 — Criar componentes base do design system
**Prioridade:** P1

# BACKEND (Spring Boot)

## BE-005 — Busca textual
**Prioridade:** P1 · **Dependências:** BE-003 · **Status:** Parcial (2026-10-16): FTS português

## BE-010 — Fila de jobs no PostgreSQL
**Status:** Concluído (2026-10-16): job_queue

# SEGUNDO MARCO VISUAL

## FE-122 — Aviso de cookies (LGPD)
**Prioridade:** P1 (antes de ligar o AdSense) · **Status:** Review (2026-11-10): aviso fixo

## BE-023 — Radar de pautas
**Status:** Proposto (2026-11-04)
`;

describe("backlog do painel do projeto", () => {
  it("lê código, título, área, prioridade e status de cada item", () => {
    const items = parseBacklog(BACKLOG);
    expect(items.map((i) => [i.id, i.status])).toEqual([
      ["FE-001", "done"],
      ["FE-006", "todo"],
      ["BE-005", "doing"],
      ["BE-010", "done"],
      ["FE-122", "review"],
      ["BE-023", "todo"],
    ]);
    expect(items[0]).toMatchObject({
      title: "Criar repositório e estrutura inicial",
      group: "Fundação",
      priority: "P0",
    });
    // Item fora da seção certa (depois dos marcos) vai para a área pelo código.
    expect(items[4].group).toBe("Portal público");
    expect(items[2].note).toBe("Parcial (2026-10-16): FTS português");
  });

  it("áreas por código e status em português ou inglês", () => {
    expect(groupOf("FE-159")).toBe("Painel");
    expect(groupOf("OPS-003")).toBe("Qualidade e entrega");
    expect(groupOf("CT-001")).toBe("Contrato");
    expect(statusOf("In Progress (2026-10-15)")).toBe("doing");
    expect(statusOf(undefined)).toBe("todo");
  });

  it("conta o andamento", () => {
    const p = progressOf(parseBacklog(BACKLOG));
    expect(p).toEqual({ done: 2, total: 6, byStatus: { todo: 2, doing: 1, review: 1, done: 2 } });
  });
});

describe("histórico do painel do projeto", () => {
  it("classifica os commits pelos tipos do Conventional Commits", () => {
    const sep = "\x1f";
    expect(
      parseCommitLine(`abc${sep}2026-11-11T01:00:00-03:00${sep}feat: adiciona mascote`),
    ).toMatchObject({
      kind: "added",
      message: "adiciona mascote",
    });
    expect(
      parseCommitLine(`d${sep}2026-11-11T01:00:00-03:00${sep}fix(api): corrige 2FA`),
    ).toMatchObject({
      kind: "fixed",
      scope: "api",
    });
    expect(parseCommitLine(`e${sep}2026-11-11T01:00:00-03:00${sep}Merge branch x`)?.kind).toBe(
      "chore",
    );
    expect(parseCommitLine("quebrada")).toBeNull();
  });

  it("agrupa por dia no horário de Brasília", () => {
    const sep = "\x1f";
    const commits = [
      parseCommitLine(`a${sep}2026-11-11T01:30:00Z${sep}feat: x`)!,
      parseCommitLine(`b${sep}2026-11-10T20:00:00Z${sep}fix: y`)!,
    ];
    // 01:30 UTC de 11/11 = 22:30 de 10/11 em Brasília: mesmo dia do outro.
    expect(groupByDay(commits).map(([day, list]) => [day, list.length])).toEqual([
      ["2026-11-10", 2],
    ]);
  });
});
