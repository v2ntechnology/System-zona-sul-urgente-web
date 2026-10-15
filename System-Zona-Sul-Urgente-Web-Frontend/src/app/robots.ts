import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

// robots.txt. Fora de produção bloqueia tudo (staging não pode ir para o Google).
export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Painel, APIs e resultados de busca (conteúdo infinito/duplicado) ficam fora.
      disallow: ["/admin", "/api/", "/busca"],
    },
    sitemap: [
      new URL("/sitemap.xml", siteConfig.url).toString(),
      new URL("/news-sitemap.xml", siteConfig.url).toString(),
    ],
  };
}
