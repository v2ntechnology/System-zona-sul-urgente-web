# Modelo de dados: Importar posts antigos do Instagram

Migração nova: `V11__instagram_history.sql` (nenhuma migração existente é editada).

## Tabela nova `instagram_history_imports`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | `uuid` PK DEFAULT `uuidv7()` | |
| `ig_user_id` | `varchar(64)` NOT NULL | conta de onde lê |
| `from_date` | `date` | nulo = desde o primeiro post |
| `to_date` | `date` | nulo = até hoje |
| `excluded_ids` | `jsonb` NOT NULL DEFAULT `'[]'` | IDs da Meta desmarcados na lista (máx. 1000) |
| `status` | `varchar(12)` NOT NULL | `RUNNING` \| `COMPLETED` \| `CANCELLED` \| `FAILED` |
| `read_count` | `integer` NOT NULL DEFAULT 0 | posts lidos dentro do período |
| `added_count` | `integer` NOT NULL DEFAULT 0 | novos na fila |
| `existing_count` | `integer` NOT NULL DEFAULT 0 | já estavam na fila (ganharam foto se faltava) |
| `excluded_count` | `integer` NOT NULL DEFAULT 0 | pulados por exclusão |
| `requested_by` | `uuid` → `users` | |
| `started_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `finished_at` | `timestamptz` | |
| `error` | `varchar(500)` | motivo em português |

Índice único parcial: `(status) WHERE status = 'RUNNING'` — no máximo uma em andamento (FR-006).

## `instagram_posts` (existente) — colunas novas

| Coluna | Tipo | Regra |
|---|---|---|
| `history_import_id` | `uuid` → `instagram_history_imports` | preenchido = post antigo; nunca gera rascunho sozinho |
| `source_checked_at` | `timestamptz` | última conferência individual (rodízio dos antigos com notícia) |

## Tabelas novas do lote

`instagram_generation_batches`: `id uuid PK`, `requested_by uuid → users`, `requested_by_name varchar(120) NOT NULL`,
`total integer NOT NULL`, `skipped integer NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.

`instagram_generation_batch_items`: `batch_id uuid → instagram_generation_batches ON DELETE CASCADE`,
`post_id varchar(64) → instagram_posts ON DELETE CASCADE`, `PRIMARY KEY (batch_id, post_id)`.

Andamento do lote = situação atual dos posts do lote: `IMPORTED` com notícia → gerado; `ERROR` → erro; `NEW` →
pendente.

## Transições

Importação: `RUNNING → COMPLETED` (última página ou passou de `from_date`) · `RUNNING → CANCELLED` (Administrador,
conta desligada/trocada) · `RUNNING → FAILED` (acesso perdido, job de página DEAD).

Post antigo: entra `NEW` (com mídia via `INSTAGRAM_IMPORT`) e só sai de `NEW` por "Gerar agora", lote ou "Ignorar".

## Jobs

| Tipo | Payload | Regra |
|---|---|---|
| `INSTAGRAM_HISTORY_PAGE` | `{ importId, after }` | sai sem fazer nada se a importação não está `RUNNING`; enfileira a próxima página |
| `INSTAGRAM_IMPORT` (existente) | `{ postId, sources?, altText? }` | usa os endereços do payload; `GET /{media-id}` só se o download falhar; gera só se `source = 'API'` e `history_import_id IS NULL` |
| `INSTAGRAM_GENERATE` | `{ postId, batchId }` | `run_at` escalonado; `max_attempts = 48`; 429 da IA = nova tentativa |

`JobQueue.enqueue(type, payload, runAt, maxAttempts)` — sobrecarga nova; a atual continua.

## Auditoria

Ações novas: `INSTAGRAM_HISTORY` (detalhe `event`: `start`, `cancel`, `completed`, `failed`) e `AI_BATCH`. A V11
recria o `CHECK` de `audit_logs.action` com todos os valores atuais mais esses dois.

## Configuração (`zsu.instagram`)

| Propriedade | Padrão | Uso |
|---|---|---|
| `batch-per-minute` | `4` | ritmo do lote (FR-011) |
| `old-news-checks-per-sync` | `20` | antigos com notícia conferidos por varredura (FR-014) |
| `history-max-excluded` | `1000` | limite de desmarcados por importação |
