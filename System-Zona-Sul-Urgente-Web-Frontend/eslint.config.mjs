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
    // Mocks só podem ser lidos pelos services (FE-010): o resto do app usa @/services.
    ignores: ["src/lib/utils.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "cn", message: 'Importe cn de "@/lib/utils".' }],
          patterns: [
            { group: ["@/mocks/*"], message: "Use os services (@/services/*), nunca os mocks." },
          ],
        },
      ],
    },
  },
  {
    // O gerador da carga de exemplo do backend também lê os mocks.
    files: ["src/services/**", "src/mocks/**", "scripts/seed/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "cn", message: 'Importe cn de "@/lib/utils".' }] },
      ],
    },
  },
  {
    // Testes de ponta a ponta (Playwright): o `use` das fixtures não é o hook do React.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
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
    // Saídas do Playwright (QA-002).
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
