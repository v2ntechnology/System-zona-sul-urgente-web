import { describe, expect, it } from "vitest";

import {
  countInstagramPostsByStatus,
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
});
