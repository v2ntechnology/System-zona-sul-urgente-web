import { describe, expect, it } from "vitest";

import {
  countInstagramPostsByStatus,
  getInstagramConnection,
  listInstagramPosts,
} from "@/services/admin/instagram-service";

describe("instagram-service", () => {
  it("lista do mais novo para o mais antigo e filtra por status", async () => {
    const all = await listInstagramPosts();
    expect(all.map((p) => p.postedAt)).toEqual([...all.map((p) => p.postedAt)].sort().reverse());
    const errors = await listInstagramPosts("ERROR");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((p) => p.status === "ERROR" && p.error)).toBe(true);
  });

  it("liga o post à notícia gerada, com texto para comparar", async () => {
    const changed = await listInstagramPosts("CHANGED_AT_SOURCE");
    expect(changed[0].news?.title).toBeTruthy();
    expect(changed[0].news?.paragraphs.length).toBeGreaterThan(0);
    expect(changed[0].currentCaption).not.toBe(changed[0].caption);
    const draft = (await listInstagramPosts("IMPORTED")).find((p) => p.news?.status === "DRAFT");
    expect(draft?.news?.summary).toBeTruthy();
  });

  it("contagem bate com o total", async () => {
    const counts = await countInstagramPostsByStatus();
    const sum = Object.entries(counts)
      .filter(([k]) => k !== "ALL")
      .reduce((total, [, n]) => total + n, 0);
    expect(sum).toBe(counts.ALL);
  });

  it("conexão no formato do contrato da spec 001: sem acesso e sem publicar sozinho", async () => {
    const connection = await getInstagramConnection();
    expect(connection).not.toBeNull();
    expect(connection?.status).toBe("ACTIVE");
    expect(connection?.tokenLast4).toHaveLength(4);
    expect(connection?.tokenExpiresAt).toBeNull();
    expect(connection).not.toHaveProperty("publishRule");
    expect(connection).not.toHaveProperty("accessToken");
  });
});

describe("instagram-service — espera por cota (spec 004)", () => {
  it("posts aguardando espaço ou a IA trazem waiting e waitingUntil", async () => {
    const all = await listInstagramPosts();
    const ai = all.find((p) => p.waiting === "AI");
    expect(ai?.waitingUntil).toBe("2026-10-16T07:00:00.000Z");
    const space = all.find((p) => p.waiting === "SPACE");
    expect(space).toBeDefined();
    expect(space?.waitingUntil).toBeNull();
    expect(all.filter((p) => !p.waiting).every((p) => p.waiting === null)).toBe(true);
  });
});
