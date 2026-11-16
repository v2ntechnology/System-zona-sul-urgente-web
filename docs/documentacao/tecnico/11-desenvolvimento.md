# 11. Desenvolvimento

## Pré-requisitos

Node 24, JDK 25 e Docker. Para os testes de fotos do backend: libvips com os plugins libheif (AVIF e HEIC) — ver
`infra/dev/jdk-vips.Dockerfile`. Para gerar os PDFs da documentação: `uv`.

## Rodando

```bash
docker compose -f infra/compose.yaml up -d                     # PostgreSQL em 127.0.0.1:5432

cd System-Zona-Sul-Urgente-Web-Backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run            # API :8080, Swagger em /api/v1/docs

cd System-Zona-Sul-Urgente-Web-Frontend
cp .env.example .env.local && npm ci && npm run dev            # site :3000
```

Stack inteira em contêineres: `docker compose -f infra/compose.yaml --profile app up -d --build`.

Sem `API_URL` no `.env.local`, o site roda só com os dados de exemplo e o painel fica em modo demonstração. Com
`API_URL=http://localhost:8080`, login de verdade (perfil `local`, senha `zonasul-local`):
`ana.ribeiro@zonasulurgente.com.br` (repórter, entra direto) e `juliana.prado@zonasulurgente.com.br`
(administradora, cadastra o 2FA no primeiro acesso).

No `.env` do backend, deixe **comentadas** as variáveis sem valor: uma linha vazia sobrescreve o padrão do perfil
`local` (ex.: `TOTP_ENCRYPTION_KEY=` vazio quebra o 2FA).

## Testes e verificações

| Comando | O que faz |
|---|---|
| `npm test` | Vitest (`src/**/*.test.ts`) |
| `npx vitest run src/lib/format.test.ts -t "nome"` | Um arquivo / um teste |
| `npm run test:e2e` | Playwright: build de produção próprio na porta 3100, sem API, painel em demonstração |
| `npx playwright test e2e/site.spec.ts --project=desktop` | Um spec / um projeto (`desktop` ou `celular`) |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | ESLint · `next typegen` + `tsc` · Prettier |
| `./mvnw verify` | Testes do backend com PostgreSQL real (Testcontainers; precisa de Docker) |
| `./mvnw test -Dtest='AdminNewsApiTests#metodo'` | Uma classe / um método |

Nos testes do backend, `zsu.jobs.enabled=false`: chame o worker e o publicador direto. `TestSessions.bearer(jdbc,
email)` cria sessão sem login/2FA. `GeminiLiveTests` só roda com `GEMINI_LIVE_TEST=true`.

O CI (`.github/workflows/ci.yml`) roda por pasta alterada: frontend (`format:check`, `lint`, `typecheck`, `test`,
`build`), e2e em job separado, e backend (`./mvnw -B verify`).

## Como uma mudança é feita (Spec Kit)

1. `/speckit-specify` descreve **o quê e por quê** em `specs/NNN-nome/spec.md`.
2. `/speckit-clarify` (opcional) tira dúvidas da spec.
3. `/speckit-plan` escreve o `plan.md` (tecnologia, verificação da constituição, o que muda em `docs/`).
4. `/speckit-tasks` gera o `tasks.md`; `/speckit-analyze` (opcional) confere a consistência.
5. `/speckit-implement` executa as tarefas.

Regras em `.specify/memory/constitution.md`. Correção pequena e óbvia não precisa de spec.

## Documentação e fim do dia

| Arquivo | Para quem |
|---|---|
| `docs/documentacao/usuario/*.md` | Manual do cliente (redação): linguagem simples, sem termos técnicos |
| `docs/documentacao/tecnico/*.md` | Desenvolvedor |
| `docs/backlog.md` | Plano: `## <ID> — Título` + `**Status:**` (lido pelo `/admin/projeto`) |
| `docs/changelog.md` | Histórico diário: Adicionado / Alterado / Removido |

`uv run scripts/gerar_pdf.py` gera `docs/pdf/zona-sul-urgente-manual.pdf` (manual) e
`docs/pdf/zona-sul-urgente-documentacao-tecnica.pdf` (manual + técnico + backlog + changelog + commits). Os PDFs vão
para o git. Ao encerrar o dia, `/encerrar-dia` atualiza tudo isso.

A área do desenvolvedor `/admin/projeto` (só `npm run dev`, só Administrador) mostra visão geral, board, specs,
changelog, commits e documentos.

## Convenções

- Next.js 16 difere dos tutoriais (`proxy.ts`, `use cache`, `LayoutProps`): consulte `node_modules/next/dist/docs/`.
- `src/components/ui/` são componentes shadcn: evite editar à mão.
- Schema só por migração Flyway nova (`V<n>__nome.sql`); migração aplicada não é editada.
- Commits: `<prefixo em inglês>: <descrição em português>`, sem `Co-Authored-By`.
