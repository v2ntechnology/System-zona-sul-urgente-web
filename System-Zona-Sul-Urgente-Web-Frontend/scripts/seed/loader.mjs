// Resolve os imports "@/..." e relativos sem extensão do src/ para rodar os mocks direto
// no Node (que já remove os tipos do TypeScript). Só para o gerador da carga de exemplo.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(spec, ctx, next) {
  let path = null;
  if (spec.startsWith("@/")) path = SRC + spec.slice(2);
  else if (
    spec.startsWith(".") &&
    ctx.parentURL?.includes("/src/") &&
    !/\.[cm]?[jt]sx?$/.test(spec)
  )
    path = fileURLToPath(new URL(spec, ctx.parentURL));
  if (path) {
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(path + ext)) return next(`file://${path}${ext}`, ctx);
    }
  }
  return next(spec, ctx);
}
