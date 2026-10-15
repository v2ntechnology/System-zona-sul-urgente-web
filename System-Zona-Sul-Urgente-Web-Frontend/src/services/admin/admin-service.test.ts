import { describe, expect, it } from "vitest";

import {
  countAdminNewsByStatus,
  getDashboardStats,
  listAdminNews,
} from "@/services/admin/admin-service";

describe("admin-service", () => {
  it("lista fora da lixeira por padrão e pagina", async () => {
    const page = await listAdminNews({ pageSize: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.pageCount).toBeGreaterThan(1);
    expect(page.items.every((n) => !n.deletedAt)).toBe(true);
  });

  it("filtra por status, lixeira, origem e busca sem acento", async () => {
    expect(
      (await listAdminNews({ status: "DRAFT" })).items.every((n) => n.status === "DRAFT"),
    ).toBe(true);
    const trash = await listAdminNews({ status: "DELETED" });
    expect(trash.total).toBe(1);
    expect(trash.items[0].deletedAt).toBeDefined();
    expect(
      (await listAdminNews({ origin: "INSTAGRAM" })).items.every((n) => n.origin === "INSTAGRAM"),
    ).toBe(true);
    expect((await listAdminNews({ query: "reboucas" })).total).toBeGreaterThan(0);
  });

  it("página fora do intervalo vai para a última válida", async () => {
    const page = await listAdminNews({ page: 999, pageSize: 10 });
    expect(page.page).toBe(page.pageCount);
  });

  it("contagens batem com o dashboard", async () => {
    const counts = await countAdminNewsByStatus();
    const stats = await getDashboardStats();
    expect(counts.DRAFT).toBe(stats.drafts);
    expect(counts.IN_REVIEW).toBe(stats.inReview);
    expect(stats.instagramNew).toBe(2);
  });
});

describe("lateral da listagem", () => {
  it("fila de revisão só tem notícias em revisão, mais antigas primeiro", async () => {
    const { getReviewQueue } = await import("@/services/admin/admin-service");
    const queue = await getReviewQueue();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((n) => n.status === "IN_REVIEW")).toBe(true);
    const dates = queue.map((n) => n.updatedAt);
    expect(dates).toEqual([...dates].sort());
  });

  it("tópicos em alta vêm ordenados por uso", async () => {
    const { getTrendingTags } = await import("@/services/admin/admin-service");
    const tags = await getTrendingTags();
    expect(tags.length).toBeGreaterThan(0);
    const counts = tags.map((t) => t.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
