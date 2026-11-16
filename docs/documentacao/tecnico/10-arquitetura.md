# 10. Arquitetura

## Visão geral

```
Leitor / Redação ──► Cloudflare (DNS, CDN, WAF) ──► Next.js (site + painel, BFF) ──► API Spring Boot ──► PostgreSQL
                                                         ▲                               │
                                                         └──── POST /api/revalidate ◄────┘  (fila de jobs)
                                       Fotos: Cloudflare R2 (media.<domínio>)   IA: Gemini
```

| Camada | Tecnologia | Pasta |
|---|---|---|
| Site e painel | Next.js 16 (App Router, Cache Components), React 19, TypeScript strict, Tailwind 4, shadcn/ui, Tiptap | `System-Zona-Sul-Urgente-Web-Frontend/` |
| API | Java 25, Spring Boot 4, Spring Security, JdbcClient/JPA, Flyway, springdoc | `System-Zona-Sul-Urgente-Web-Backend/` |
| Banco | PostgreSQL 18 (também fila de jobs e busca em português) | `infra/compose.yaml` |
| Borda e mídia | Cloudflare (CDN, WAF), R2 para fotos | — |

## O Next é o BFF

O navegador nunca fala com a API. Só o servidor do Next chama o Spring:

- **Leitura pública**: `src/services/api/client.ts` (`apiGet` → `/api/v1/public/**`) e `public-api.ts`, com
  `use cache` + `cacheTag`.
- **Painel**: `src/services/admin/admin-api.ts` (`adminFetch` → `/api/v1/admin/**`) lê o cookie de sessão
  (httpOnly) e repassa como `Authorization: Bearer`. Nunca em cache. `401` → login. As mutações são Server Actions
  (`app/admin/**/actions.ts`).
- `src/proxy.ts` (o "middleware" do Next 16) só manda para o login quem está sem cookie; a autorização é sempre da
  API.

## Modo sem API (dados de exemplo)

Com `API_URL` vazio, cada função de `src/services/*` usa `src/mocks/` com a **mesma assinatura**. Componentes e
páginas só importam de `src/services`. Os mocks usam data fixa (`MOCK_NOW` = 2026-10-15). O seed do backend
(`db/seed/R__seed_local.sql`) é **gerado** dos mocks (`npm run seed:export`), com os mesmos IDs e slugs.

Dentro de `use cache` o Next troca exceções por um erro genérico; por isso `400` volta como valor `{ badRequest }` e o
service chama `unwrap()` fora do cache para virar `ServiceError`.

## Publicar → site atualizado

1. Notícia muda no painel → `AdminNewsService` publica `NewsChangedEvent`.
2. `NewsSiteRevalidation` enfileira o job `CACHE_INVALIDATE` **na mesma transação** (outbox) com as tags afetadas
   (`news:<slug>`, `news`, `home`, `breaking`, editoria, bairro...).
3. `JobWorker` chama `POST /api/revalidate` no Next com `REVALIDATE_SECRET` → `revalidateTag(tag, { expire: 0 })`.
4. A purga da Cloudflare entra depois desse passo (BE-011, pendente).

As strings de tag são contrato entre `src/lib/cache-tags.ts` e o backend.

Agendadas: `ScheduledPublisher` publica as que chegaram no horário, pelo relógio do banco.

## Destaques da home (spec 003)

- A ordem é `news.featured_rank` (1 = manchete, 2–3 ao lado, 4–7 faixa, 8–10 reserva), com `CHECK 1..10` e índice
  único parcial (V11). `HomeFeaturedService` concentra as regras: só publicadas, patrocinada nunca na 1, deslocamento
  dos atalhos e saída automática ao despublicar/lixeira (patrocinada não sobe para a manchete). Toda gravação zera e
  regrava as posições (`replaceFeatured`), sob `pg_advisory_xact_lock`.
- `GET/PUT /api/v1/admin/home/featured` (assinatura da ordem → 409 com `current` se outra pessoa salvou antes) e
  `POST /api/v1/admin/news/{id}/feature` (`MAIN`/`HIGHLIGHT`/`NONE`), com `news.publish`; auditoria `HOME_FEATURE`.
- Público: `GET /news/featured` monta a manchete automática (publicada mais recente não patrocinada) quando a 1 está
  vazia e devolve `mainAutomatic`.
- Revalidação: as Server Actions chamam `revalidateTag("home")` na hora; a API também enfileira `CACHE_INVALIDATE`.
- As regras de deslocamento existem também no painel (`src/lib/home-featured.ts`) para a tela e a prévia — mudar de um
  lado exige mudar do outro.

## Instagram → rascunho (spec 001)

1. O Administrador cola o **ID da conta** e o **acesso** (token de usuário do sistema do login unificado, sem
   vencimento, só `instagram_basic`). `InstagramConnectionService` confere na Graph API
   (`graph.facebook.com/v27.0/{id}`) e grava em `instagram_connection` com `SecretCipher` (mesma chave do 2FA).
2. `InstagramSyncScheduler` roda `InstagramSyncService.sync()` a cada `zsu.instagram.sync-interval` (15 min; também ao
   ligar e no "Sincronizar agora"): lê os posts do mais novo para o mais antigo, insere os novos (`source = 'API'`) e
   liga pelo link os colados à mão (que continuam `MANUAL`); enfileira `INSTAGRAM_IMPORT` na mesma transação.
3. `InstagramImportJob` baixa foto, carrossel ou capa do vídeo (nunca o vídeo) para o `MediaService` e, só para posts
   da API, gera o rascunho como o ator de sistema `SyncActor` ("Sincronização do Instagram", permissões de Repórter,
   `created_by` nulo), com foto principal e crédito `Foto: Reprodução/Instagram @conta`.
4. A cada varredura, os posts dos últimos `zsu.instagram.reconcile-window` (30 dias) são conferidos: legenda diferente
   da última vista → `CHANGED_AT_SOURCE`; ausente e confirmado por `GET /{media-id}` → `REMOVED_AT_SOURCE`. A notícia
   nunca muda sozinha.
5. Erros da Meta (`InstagramGraphClient.classify`): 190/10/200/102 → conexão `REVOKED` + auditoria
   `INSTAGRAM_ACCESS_LOST`, varredura parada; limite/5xx/tempo esgotado → `failures + 1`, aviso a partir de 3.

O acesso vai sempre no cabeçalho `Authorization` e nunca aparece em resposta, log ou auditoria.

## Backend por módulo

Pacote `br.com.zonasulurgente.api`, um módulo por domínio. Módulos não acessam o repositório de outro; conversam
por interfaces e eventos.

| Módulo | Responsabilidade |
|---|---|
| `shared` | Segurança (`SecurityConfig`), erros (`problem+json`, `X-Request-Id`), records do contrato público (`shared/contract/`, espelhados em `src/types/`) |
| `news` | Leitura pública, CRUD do painel, versões, publicação agendada, revalidação |
| `taxonomy` | Editorias (um nível de hierarquia, redirecionamentos), tópicos |
| `team` | Equipe, convites (7 dias, uso único), autores, primeiro administrador |
| `auth` | Login, sessão (hash do token no banco), TOTP com segredo cifrado (AES-256) |
| `audit` | Auditoria na transação da ação |
| `media` | Upload até 10 MB, derivados AVIF/WebP via libvips; armazenamento local ou S3/R2 |
| `instagram` | Conexão com a conta (acesso do login unificado da Meta, cifrado), varredura a cada 15 min, job `INSTAGRAM_IMPORT` (mídia + rascunho pela IA), conferência de legenda alterada/post apagado (spec 001) |
| `ai` | `EditorialAiProvider`: Gemini (com modelo de reserva) ou falso |
| `site` | Job de invalidação do cache do site |
| `jobs` | Fila no PostgreSQL (`SKIP LOCKED`), worker e agendamento |

## Segurança

- `GET /api/v1/public/**` aberto; `/api/v1/admin/**` exige sessão; o resto é negado. Permissão por ação com
  `@PreAuthorize`. A matriz de `src/config/permissions.ts` só esconde itens na interface.
- Sessão stateless por token Bearer (a API não lê cookies, por isso sem CSRF nela; o CSRF do navegador é barrado no
  Next com SameSite=Lax e a origem das Server Actions).
- 2FA obrigatório para Administrador, Editor e Comercial.
- Erros RFC 9457 em português, sem stack trace; Swagger desligado no perfil `prod`.

## Perfis de execução da API

| Perfil | Efeito |
|---|---|
| (padrão) | Sem seed; IA `fake`; fotos em pasta local. |
| `local` | Carrega `db/seed`; chave TOTP e segredo de revalidação de desenvolvimento. Nunca em produção. |
| `prod` | Fotos no R2, IA Gemini (sem `GEMINI_API_KEY` a API não sobe), documentação da API desligada. |
