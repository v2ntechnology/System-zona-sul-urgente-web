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

  it("destaque da home tem manchete e secundários em ordem editorial", async () => {
    const featured = await getFeatured();
    expect(featured?.main.slug).toBe("temporal-alaga-ruas-de-copacabana-e-botafogo");
    expect(featured?.secondary.length).toBeGreaterThanOrEqual(2);
  });

  it("dados de exemplo cobrem os critérios do FE-009", async () => {
    const all = (await getLatest({ limit: MAX_PAGE_SIZE })).items;
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(new Set(all.map((n) => n.category.slug)).size).toBe(8);
    expect(all.some((n) => n.isUrgent)).toBe(true);
    expect(all.some((n) => n.isSponsored)).toBe(true);
    expect(all.every((n) => n.image?.alt)).toBe(true);
    expect(new Set(all.map((n) => n.slug)).size).toBe(all.length);
  });
});
