import { describe, expect, it } from "vitest";

import { buildRss, rfc822 } from "@/lib/rss";
import { getBySlug } from "@/services/news-service";

describe("buildRss", () => {
  it("gera RSS 2.0 com item, link canônico, imagem e autores", async () => {
    const news = (await getBySlug("camara-aprova-ampliacao-de-ciclovias-na-zona-sul"))!;
    const xml = buildRss({
      title: "Feed",
      description: "Desc",
      pagePath: "/",
      feedPath: "/feed.xml",
      items: [news],
    });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("/politica/camara-aprova-ampliacao-de-ciclovias-na-zona-sul</link>");
    expect(xml).toContain("<media:content url=");
    expect(xml.match(/<dc:creator>/g)).toHaveLength(2);
  });

  it("escapa caracteres especiais no título", async () => {
    const news = (await getBySlug("camara-aprova-ampliacao-de-ciclovias-na-zona-sul"))!;
    const xml = buildRss({
      title: "A & B",
      description: "<x>",
      pagePath: "/",
      feedPath: "/feed.xml",
      items: [{ ...news, title: 'Título com <tag> & "aspas"' }],
    });
    expect(xml).toContain("Título com &lt;tag&gt; &amp; &quot;aspas&quot;");
    expect(xml).toContain("<title>A &amp; B</title>");
    expect(xml).not.toContain("<tag>");
  });

  it("formata a data em RFC 822", () => {
    expect(rfc822("2026-10-15T14:30:00-03:00")).toBe("Thu, 15 Oct 2026 17:30:00 GMT");
  });
});
