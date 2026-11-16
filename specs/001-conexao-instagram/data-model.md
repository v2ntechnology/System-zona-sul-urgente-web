# Modelo de dados: Conexão com a conta do Instagram

Migração nova: `V10__instagram_connection.sql` (Flyway; nenhuma migração existente é editada).

## Tabela nova `instagram_connection`

Uma conta ligada por vez (linha única).

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `smallint` PK | sempre `1` (`CHECK (id = 1)`) |
| `ig_user_id` | `varchar(64)` NOT NULL | ID da conta na Meta |
| `username` | `varchar(100)` NOT NULL | nome de usuário confirmado na validação |
| `token_cipher` | `text` NOT NULL | acesso cifrado (`SecretCipher`); nunca sai da API |
| `token_last4` | `varchar(4)` NOT NULL | para a tela reconhecer qual acesso está em uso |
| `token_expires_at` | `timestamptz` | nulo = não vence (login unificado) |
| `status` | `varchar(10)` NOT NULL | `ACTIVE` \| `REVOKED` |
| `connected_by` | `uuid` → `users` | quem ligou |
| `connected_at` | `timestamptz` NOT NULL | |
| `backfill_since` | `timestamptz` NOT NULL | `connected_at - 7 dias` (FR-006) |
| `last_sync_at` | `timestamptz` | última tentativa |
| `last_success_at` | `timestamptz` | última sincronização que deu certo |
| `last_error` | `varchar(500)` | mensagem em português |
| `failures` | `integer` NOT NULL DEFAULT 0 | falhas seguidas (aviso a partir de 3) |

Trocar de conta = sobrescrever a linha (com `backfill_since` novo). Desligar = apagar a linha.

## Tabela `instagram_posts` (existente, V8) — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `ig_media_id` | `varchar(64)` UNIQUE | nulo nos manuais até a varredura encontrar o mesmo link |
| `ig_user_id` | `varchar(64)` | conta de origem (troca de conta não apaga posts antigos) |
| `media_product_type` | `varchar(20)` | `FEED` \| `REELS` (informativo) |
| `needs_photo` | `boolean` NOT NULL DEFAULT false | mídia indisponível (FR-010) |
| `main_media_id` | `uuid` → `media_assets` | foto principal escolhida |

`source` já aceita `'API'`. O `CHECK` de `status` não muda.

## Tabela nova `instagram_post_media`

| Coluna | Tipo | Regra |
|---|---|---|
| `post_id` | `varchar(64)` → `instagram_posts(id)` ON DELETE CASCADE | |
| `position` | `smallint` | ordem do carrossel (0 = primeira) |
| `media_asset_id` | `uuid` → `media_assets(id)` | imagem guardada pelo `MediaService` |
| `kind` | `varchar(12)` | `IMAGE` \| `VIDEO_COVER` |
| PK | `(post_id, position)` | job idempotente: repetir não duplica |

## Transições de `instagram_posts.status`

```
(varredura) ──► NEW ──(job INSTAGRAM_IMPORT: mídia + IA)──► IMPORTED
                 │                                   └──falha da IA──► ERROR ──(Reprocessar)──► IMPORTED
                 └──(Ignorar)──► IGNORED ──(Restaurar)──► NEW
IMPORTED ──(legenda mudou)──► CHANGED_AT_SOURCE ──(Marcar como revisado)──► IMPORTED
IMPORTED | CHANGED_AT_SOURCE ──(post apagado)──► REMOVED_AT_SOURCE
```

Manual: entra `NEW` e só gera com "Gerar agora" (como hoje). Sincronizado: o job gera sozinho.

## Jobs (fila `job_queue`, V5)

| Tipo | Payload | Idempotência |
|---|---|---|
| `INSTAGRAM_IMPORT` | `{ "postId": "..." }` | mídias por `(post_id, position)`; IA só se `status IN (NEW, ERROR)` e `news_id IS NULL` |

## Auditoria (`AuditAction`, novos valores)

`INSTAGRAM_CONNECT`, `INSTAGRAM_DISCONNECT`, `INSTAGRAM_ACCESS_LOST`. A importação sincronizada usa o
`INSTAGRAM_IMPORT` existente com `detail("source", "API")`. Nunca registrar o acesso.

## Configuração (`zsu.instagram`, `application.yml`)

| Propriedade | Padrão | Uso |
|---|---|---|
| `graph-base-url` | `https://graph.facebook.com/v27.0` | testes apontam para servidor local |
| `sync-interval` | `15m` | ciclo da varredura |
| `backfill` | `7d` | posts antigos na conexão |
| `reconcile-window` | `30d` | janela de legenda alterada / post apagado |
| `failures-before-alert` | `3` | aviso no painel |
| `timeout` | `20s` | chamadas à Meta e download de mídia |

Nenhuma variável de ambiente nova: o acesso é colado no painel e guardado cifrado.
