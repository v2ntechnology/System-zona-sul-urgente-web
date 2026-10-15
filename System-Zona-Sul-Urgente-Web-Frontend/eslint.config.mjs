import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // `cn` precisa vir de @/lib/utils (tem a escala tipográfica registrada).
    // Componentes adicionados pelo `shadcn add` importam de "cn" e devem ser ajustados.
    ignores: ["src/lib/utils.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "cn", message: 'Importe cn de "@/lib/utils".' }] },
      ],
    },
  },
  // Desliga regras de estilo que conflitam com o Prettier (deve ficar por último).
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
