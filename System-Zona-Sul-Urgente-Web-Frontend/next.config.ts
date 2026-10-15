import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Impede o `next dev` de criar AGENTS.md (regra do projeto: só .claude/).
  agentRules: false,
  // Saída enxuta para a imagem Docker (self-hosting atrás da Cloudflare).
  output: "standalone",
  poweredByHeader: false,
  // Fixado no build (inline): o painel inteiro decide igual, nas partes estáticas e nas
  // dinâmicas. Sem isso, páginas estáticas leriam o valor do build e as dinâmicas o do
  // servidor — o painel ficaria meio aberto, meio fechado.
  env: { ADMIN_PREVIEW: process.env.ADMIN_PREVIEW ?? "" },
  images: {
    // Next 16 exige a lista de qualidades permitidas.
    qualities: [75],
    formats: ["image/avif", "image/webp"],
    // Fotos dos dados de exemplo (FE-009). Em produção as imagens vêm do R2
    // (media.<dominio>) por um loader próprio — ver ARCHITECTURE §18.
    remotePatterns: [new URL("https://picsum.photos/**")],
  },
  async headers() {
    return [
      {
        // Service worker sempre atualizado e restrito ao próprio site.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
