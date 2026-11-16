import { describe, expect, it } from "vitest";

import { getHomeFeatured } from "@/services/admin/home-featured-service";

describe("home-featured-service (modo demonstração)", () => {
  it("devolve as 10 posições com a manchete dos dados de exemplo", async () => {
    const featured = await getHomeFeatured();
    expect(featured?.slots).toHaveLength(10);
    expect(featured?.slots.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(featured?.slots[0].news?.title).toBeTruthy();
    expect(featured?.slots[0].news?.isSponsored).toBe(false);
    expect(featured?.signature).toBeTruthy();
  });
});
