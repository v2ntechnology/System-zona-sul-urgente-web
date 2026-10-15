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
