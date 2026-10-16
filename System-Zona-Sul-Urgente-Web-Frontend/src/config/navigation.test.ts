import { describe, expect, it } from "vitest";

import { RESERVED_SLUGS, routes } from "@/config/navigation";
import { getCategories, getNeighborhoods, getSiteSections } from "@/services/taxonomy-service";

describe("navegação", () => {
  it("menu vem das editorias ativas, na ordem cadastrada, com as subeditorias", async () => {
    const sections = await getSiteSections();
    expect(sections.map((s) => s.slug).slice(0, 3)).toEqual(["seguranca", "transito", "cidade"]);
    expect(sections.filter((s) => s.inBar)).toHaveLength(7);
    expect(sections.find((s) => s.slug === "entretenimento")?.children?.map((c) => c.href)).toEqual(
      ["/entretenimento/gastronomia", "/entretenimento/eventos"],
    );
  });

  it("todas as editorias do menu existem na taxonomia", async () => {
    const slugs = new Set((await getCategories()).map((c) => c.slug));
    for (const section of await getSiteSections()) {
      expect(slugs).toContain(section.slug);
      for (const child of section.children ?? []) {
        expect(slugs).toContain(child.href.split("/").at(-1));
      }
    }
  });

  it("nenhuma editoria usa nome reservado de rota fixa", async () => {
    for (const category of await getCategories()) {
      expect(RESERVED_SLUGS.has(category.slug)).toBe(false);
    }
  });

  it("bairros do menu existem na taxonomia", async () => {
    const slugs = new Set((await getNeighborhoods()).map((n) => routes.neighborhood(n.slug)));
    const { neighborhoods } = await import("@/config/navigation");
    for (const item of neighborhoods) expect(slugs).toContain(item.href);
  });

  it("monta URLs no padrão CNN/g1", () => {
    expect(routes.category({ slug: "esportes" })).toBe("/esportes");
    expect(routes.category({ slug: "gastronomia", parent: { slug: "entretenimento" } })).toBe(
      "/entretenimento/gastronomia",
    );
    expect(routes.news({ slug: "x", category: { slug: "seguranca" } })).toBe("/seguranca/x");
  });
});
