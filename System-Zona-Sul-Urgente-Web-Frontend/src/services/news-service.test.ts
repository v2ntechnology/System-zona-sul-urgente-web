import { describe, expect, it } from "vitest";

import { ServiceError } from "@/services/errors";
import {
  getBreakingNews,
  getByCategory,
  getByNeighborhood,
  getBySlug,
  getFeatured,
  getLatest,
  getMostRead,
  getNewsForNewsSitemap,
  getNewsForSitemap,
  getVideos,
  resolveSectionPath,
  MAX_PAGE_SIZE,
  search,
} from "@/services/news-service";

describe("news-service", () => {
  it("lista as mais recentes primeiro e pagina por cursor sem repetir itens", async () => {
    const first = await getLatest({ limit: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();

    const dates = first.items.map((n) => n.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());

    const second = await getLatest({ limit: 10, cursor: first.nextCursor });
    const ids = new Set(first.items.map((n) => n.id));
    expect(second.items.some((n) => ids.has(n.id))).toBe(false);
  });

  it("limita o tamanho da página e rejeita cursor inválido", async () => {
    expect((await getLatest({ limit: 999 })).items.length).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    await expect(getLatest({ cursor: "lixo" })).rejects.toBeInstanceOf(ServiceError);
  });

  it("devolve null para slug, editoria ou bairro inexistentes", async () => {
    expect(await getBySlug("nao-existe")).toBeNull();
    expect(await getByCategory("nao-existe")).toBeNull();
    expect(await getByNeighborhood("nao-existe")).toBeNull();
  });

  it("monta a matéria completa com autores e relacionadas", async () => {
    const news = await getBySlug("camara-aprova-ampliacao-de-ciclovias-na-zona-sul");
    expect(news?.authors.length).toBeGreaterThan(1);
    expect(news?.related).toHaveLength(4);
    expect(news?.related.some((r) => r.id === news.id)).toBe(false);
  });

  it("busca ignora acentos e maiúsculas e aplica filtros", async () => {
    const page = await search({ query: "TUNEL reboucas" });
    expect(page.items.map((n) => n.slug)).toContain(
      "tunel-reboucas-tem-faixa-fechada-apos-acidente",
    );

    const filtered = await search({ query: "orla", categorySlug: "seguranca" });
    expect(filtered.items.length).toBeGreaterThan(0);
    expect(filtered.items.every((n) => n.category.slug === "seguranca")).toBe(true);

    expect((await search({ query: "   " })).items).toEqual([]);
  });

  it("faixa de urgentes só traz urgentes recentes", async () => {
    const breaking = await getBreakingNews();
    expect(breaking.length).toBeGreaterThan(0);
    for (const item of breaking) {
      expect((await getBySlug(item.slug))?.isUrgent).toBe(true);
    }
  });

  it("mais lidas exclui patrocinadas e respeita o período", async () => {
    const day = await getMostRead("24h", 5);
    expect(day).toHaveLength(5);
    expect(day.every((n) => !n.isSponsored)).toBe(true);
    // Notícia antiga com muitas visualizações aparece no geral, não nas 24h.
    const all = await getMostRead("all", 3);
    expect(all.map((n) => n.slug)).toContain("cameras-de-monitoramento-no-cosme-velho");
    expect(day.map((n) => n.slug)).not.toContain("cameras-de-monitoramento-no-cosme-velho");
  });

  it("lista só notícias com vídeo", async () => {
    const videos = await getVideos(4);
    expect(videos).toHaveLength(4);
    expect(videos.every((n) => n.hasVideo)).toBe(true);
  });

  it("destaque da home tem manchete e secundários em ordem editorial", async () => {
    const featured = await getFeatured();
    expect(featured?.main.slug).toBe("temporal-alaga-ruas-de-copacabana-e-botafogo");
    expect(featured?.secondary.length).toBeGreaterThanOrEqual(2);
  });

  it("dados de exemplo cobrem os critérios do FE-009", async () => {
    const all = (await getLatest({ limit: MAX_PAGE_SIZE })).items;
    expect(all.length).toBeGreaterThanOrEqual(20);
    const roots = new Set(all.map((n) => n.category.parent?.slug ?? n.category.slug));
    for (const slug of [
      "seguranca",
      "transito",
      "cidade",
      "politica",
      "economia",
      "esportes",
      "entretenimento",
      "comunidade",
    ]) {
      expect(roots).toContain(slug);
    }
    expect(all.some((n) => n.isUrgent)).toBe(true);
    expect(all.some((n) => n.isSponsored)).toBe(true);
    expect(all.every((n) => n.image?.alt)).toBe(true);
    expect(new Set(all.map((n) => n.slug)).size).toBe(all.length);
  });

  it("editoria mãe inclui as notícias das subeditorias", async () => {
    const result = await getByCategory("entretenimento", { limit: 50 });
    const slugs = new Set(result?.page.items.map((n) => n.category.slug));
    expect(slugs).toContain("gastronomia");
    expect(slugs).toContain("eventos");
  });

  describe("resolveSectionPath", () => {
    it("resolve editoria e subeditoria", async () => {
      expect(await resolveSectionPath(["seguranca"])).toMatchObject({
        type: "category",
        category: { slug: "seguranca" },
      });
      expect(await resolveSectionPath(["entretenimento", "gastronomia"])).toMatchObject({
        type: "category",
        category: { slug: "gastronomia", parent: { slug: "entretenimento" } },
      });
    });

    it("resolve matéria em editoria e em subeditoria, com a URL canônica", async () => {
      const simple = await resolveSectionPath([
        "esportes",
        "remadores-da-lagoa-conquistam-ouro-no-estadual",
      ]);
      expect(simple).toMatchObject({
        type: "news",
        canonicalPath: "/esportes/remadores-da-lagoa-conquistam-ouro-no-estadual",
      });
      const nested = await resolveSectionPath([
        "entretenimento",
        "gastronomia",
        "bares-do-leblon-lancam-circuito-de-petiscos",
      ]);
      expect(nested).toMatchObject({
        type: "news",
        canonicalPath: "/entretenimento/gastronomia/bares-do-leblon-lancam-circuito-de-petiscos",
      });
    });

    it("aponta a URL correta quando a editoria do link está desatualizada", async () => {
      const result = await resolveSectionPath([
        "cidade",
        "remadores-da-lagoa-conquistam-ouro-no-estadual",
      ]);
      expect(result?.type === "news" && result.canonicalPath).toBe(
        "/esportes/remadores-da-lagoa-conquistam-ouro-no-estadual",
      );
    });

    it("devolve null para caminhos inválidos", async () => {
      expect(await resolveSectionPath([])).toBeNull();
      expect(await resolveSectionPath(["nao-existe"])).toBeNull();
      expect(await resolveSectionPath(["gastronomia"])).toBeNull(); // sub só existe sob a mãe
      expect(await resolveSectionPath(["seguranca", "nao-existe"])).toBeNull();
      expect(await resolveSectionPath(["a", "b", "c", "d"])).toBeNull();
    });
  });

  it("busca filtra pela editoria mãe incluindo subeditorias e informa o total", async () => {
    const page = await search({ query: "leblon", categorySlug: "entretenimento", limit: 1 });
    expect(page.items[0]?.category.parent?.slug).toBe("entretenimento");
    expect(page.total).toBeGreaterThanOrEqual(1);
  });

  it("sitemap de notícias só tem as últimas 48 h e nenhuma patrocinada", async () => {
    const all = await getNewsForSitemap();
    const recent = await getNewsForNewsSitemap();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThan(all.length);
    const limit = Date.parse("2026-10-15T15:00:00-03:00") - 48 * 3_600_000;
    expect(recent.every((n) => Date.parse(n.publishedAt) >= limit)).toBe(true);
    expect(
      recent.some((n) => n.slug === "restaurante-em-botafogo-aposta-em-comida-nordestina"),
    ).toBe(false);
  });
});
