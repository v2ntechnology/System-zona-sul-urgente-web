import type { MetadataRoute } from "next";

import { routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";

// Manifesto do PWA (FE-115): torna o portal instalável como app no celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.name,
    short_name: "ZS Urgente",
    description: siteConfig.description,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/?utm_source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#024baa",
    categories: ["news"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Atalhos ao segurar o ícone (Android): as editorias mais buscadas.
    shortcuts: [
      { name: "Segurança", url: routes.category({ slug: "seguranca" }) },
      { name: "Trânsito", url: routes.category({ slug: "transito" }) },
      { name: "Buscar notícias", short_name: "Buscar", url: routes.search },
    ],
  };
}
