import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Impede o `next dev` de criar AGENTS.md (regra do projeto: só .claude/).
  agentRules: false,
  // Saída enxuta para a imagem Docker (self-hosting atrás da Cloudflare).
  output: "standalone",
  poweredByHeader: false,
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
