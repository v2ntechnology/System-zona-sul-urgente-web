# Zona Sul Urgente — Web

Portal de notícias da Zona Sul do Rio de Janeiro.

## Estrutura

```
System-zona-sul-urgente-web/
├── System-Zona-Sul-Urgente-Web-Frontend/   # Next.js 16 (portal público + /admin)
├── System-Zona-Sul-Urgente-Web-Backend/    # Spring Boot 4 + PostgreSQL (API REST /api/v1)
├── infra/                                  # Docker Compose do ambiente local
└── .github/workflows/                      # CI do frontend e do backend
```

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
