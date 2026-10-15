import sanitizeHtml from "sanitize-html";

import { siteConfig } from "@/config/site";

const siteHost = new URL(siteConfig.url).host;

// Segunda barreira do contrato (ArticleBlock): a API já sanitiza o HTML dos parágrafos,
// e o frontend sanitiza de novo antes de usar dangerouslySetInnerHTML.
// Permitido: <a href="http(s)|mailto">, <strong>, <em>, <br>. Todo o resto é removido.
export function sanitizeInlineHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["a", "strong", "em", "b", "i", "br"],
    // target/rel só existem porque o transform abaixo os define; os do texto original são descartados.
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      b: "strong",
      i: "em",
      // Links externos abrem em nova aba e não passam autoridade de SEO.
      a: (tagName, attribs) => {
        const safe: Record<string, string> = { href: attribs.href };
        if (isExternal(attribs.href)) {
          safe.target = "_blank";
          safe.rel = "noopener noreferrer nofollow";
        }
        return { tagName, attribs: safe };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "a" && !frame.attribs.href,
  });
}

function isExternal(href: string | undefined): boolean {
  if (!href || href.startsWith("/") || href.startsWith("#")) return false;
  try {
    return new URL(href).host !== siteHost;
  } catch {
    return false;
  }
}
