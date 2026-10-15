import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Impede o `next dev` de criar AGENTS.md (regra do projeto: só .claude/).
  agentRules: false,
  // Saída enxuta para a imagem Docker (self-hosting atrás da Cloudflare).
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Next 16 exige a lista de qualidades permitidas.
    qualities: [75],
    formats: ["image/avif", "image/webp"],
    // Fotos dos dados de exemplo (FE-009). Em produção as imagens vêm do R2
    // (media.<dominio>) por um loader próprio — ver ARCHITECTURE §18.
    remotePatterns: [new URL("https://picsum.photos/**")],
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
