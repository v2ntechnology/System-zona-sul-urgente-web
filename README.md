# Zona Sul Urgente — Web

Portal de notícias da Zona Sul do Rio de Janeiro.

## Estrutura

```
System-zona-sul-urgente-web/
├── System-Zona-Sul-Urgente-Web-Frontend/   # Next.js 16 (portal público + /admin)
├── System-Zona-Sul-Urgente-Web-Backend/    # Spring Boot 4 + PostgreSQL (API REST /api/v1)
├── infra/                                  # Docker Compose do ambiente local
├── docs/                                   # manual do cliente, documentação técnica, PDFs, backlog e changelog
├── scripts/gerar_pdf.py                    # gera os PDFs de docs/ (uv run scripts/gerar_pdf.py)
├── specs/                                  # uma pasta por mudança (Spec Kit)
├── .specify/                               # Spec Kit: constituição, modelos e scripts
└── .github/workflows/                      # CI do frontend e do backend
```

## Como o trabalho é feito

[Spec Kit](https://github.com/github/spec-kit), igual aos outros projetos. As regras do projeto estão na
constituição (`.specify/memory/constitution.md`). Cada mudança relevante segue
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` e fica em `specs/NNN-nome/`.
O manual do cliente fica em `docs/documentacao/usuario/`, a documentação técnica em `docs/documentacao/tecnico/` e os
PDFs dos dois em `docs/pdf/`. O andamento fica em `docs/backlog.md` e `docs/changelog.md`. Tudo isso é atualizado ao
fim do dia com `/encerrar-dia`, e o andamento aparece na área do desenvolvedor em `/admin/projeto` (só em
`npm run dev`, para Administrador).

## Stack

| Camada   | Tecnologia                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui |
| Backend  | Java 25, Spring Boot 4, Spring Security, Spring Data JPA, Flyway   |
| Banco    | PostgreSQL 18                                                     |
| Borda    | Cloudflare (DNS, CDN, WAF) · mídia no Cloudflare R2               |

## Rodando localmente

Pré-requisitos: Node 24, JDK 25 e Docker.

```bash
# 1. Banco
docker compose -f infra/compose.yaml up -d

# 2. API (http://localhost:8080 — Swagger em /api/v1/docs)
cd System-Zona-Sul-Urgente-Web-Backend && ./mvnw spring-boot:run

# 3. Portal (http://localhost:3000)
cd System-Zona-Sul-Urgente-Web-Frontend && npm ci && npm run dev
```

Stack inteira em containers: `docker compose -f infra/compose.yaml --profile app up -d --build`.

## Padrão de commits

[Conventional Commits](https://www.conventionalcommits.org/): prefixo em inglês e descrição em português.

```
feat: adiciona aba de classificados
fix: corrige data de publicação dos artigos
chore: atualiza dependências
```

Prefixos: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`, `perf`, `build`, `ci`.
Sem linhas de co-autoria (`Co-Authored-By`).
