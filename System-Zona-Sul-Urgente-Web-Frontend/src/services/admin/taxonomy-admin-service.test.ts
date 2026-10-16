import { describe, expect, it } from "vitest";

import { listCategoriesAdmin, listTagsAdmin } from "@/services/admin/taxonomy-admin-service";

describe("taxonomy-admin-service", () => {
  it("editoria mãe conta as matérias das subeditorias", async () => {
    const all = await listCategoriesAdmin();
    const parent = all.find((c) => c.slug === "entretenimento")!;
    const subs = all.filter((c) => c.parent?.slug === "entretenimento");
    expect(parent.newsCount).toBeGreaterThanOrEqual(subs.reduce((s, c) => s + c.newsCount, 0));
  });

  it("tópicos mais usados primeiro, com os duplicados de exemplo", async () => {
    const tags = await listTagsAdmin();
    const counts = tags.map((t) => t.newsCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(tags.some((t) => t.name === "Chuvas")).toBe(true);
  });
});
