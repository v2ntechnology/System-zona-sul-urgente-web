# System-Zona-Sul-Urgente-Web-Backend

API REST do portal Zona Sul Urgente.

Java 25 · Spring Boot 4 · Spring Security · Spring Data JPA · Flyway · PostgreSQL 18 · springdoc (OpenAPI).

## Rodando

```bash
docker compose -f ../infra/compose.yaml up -d   # PostgreSQL local
./mvnw spring-boot:run                           # http://localhost:8080
./mvnw verify                                    # testes (Testcontainers, precisa de Docker)
```

- Health: `GET /actuator/health`
- OpenAPI: `GET /api/v1/openapi` · Swagger UI: `/api/v1/docs` (desligados no perfil `prod`)

Configuração por variáveis de ambiente (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `PORT`); veja `.env.example`.

## Convenções

- **API:** `/api/v1/public/**` (leitura, cacheável) e `/api/v1/admin/**` (autenticada). Qualquer
  outra rota é negada por padrão em `SecurityConfig`.
- **Schema:** só via Flyway (`src/main/resources/db/migration`). O Hibernate roda com
  `ddl-auto: validate` e nunca altera o banco.
- **Módulos por domínio** dentro de `br.com.zonasulurgente.api`, cada um com
  `api/ application/ domain/ infrastructure/`:

```
br.com.zonasulurgente.api
├── shared/        # config transversal (segurança, erros, auditoria base)
├── news/          # notícias, versões, publicação
├── categories/  authors/  locations/
├── instagram/  ai/  media/
├── advertising/  analytics/  newsletter/  notifications/
├── auth/  users/  audit/  settings/
└── jobs/          # fila de jobs no PostgreSQL
```

Módulos conversam por interfaces e eventos internos, nunca acessando o repositório de outro domínio.
