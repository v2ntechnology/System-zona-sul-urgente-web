# Contrato: importação de histórico e geração em lote (API do painel)

Base: `/api/v1/admin/instagram`. Chamado só pelo servidor do Next (BFF). Erros em `problem+json`, em português.

## `GET /history/preview?from=AAAA-MM-DD&to=AAAA-MM-DD&after=<cursor>`

Permissão `instagram.settings`. Uma página (até 25) dos posts da conta **dentro do período**, do mais novo para o mais
antigo, para o Administrador desmarcar antes de importar.

```json
{
  "items": [
    {
      "igMediaId": "18120202706070233",
      "permalink": "https://www.instagram.com/reel/DfuxH-qiYR8/",
      "postedAt": "2026-08-26T23:40:00Z",
      "mediaType": "VIDEO",
      "captionExcerpt": "Ressaca em Copacabana, posto 6…",
      "thumbnailUrl": "https://scontent…",
      "inQueue": false
    }
  ],
  "after": "QVFIU…"
}
```

`after` nulo = acabou o período. `thumbnailUrl` é o endereço temporário da Meta (só para mostrar na lista).
**409** sem conta ativa · **400** datas inválidas (`from` > `to`, futuro).

## `POST /history` — iniciar

Permissão `instagram.settings`.

```json
{ "from": "2026-01-01", "to": "2026-10-31", "excludedIds": ["18120202706070233"] }
```

`from`/`to` opcionais (nulo = todo o histórico de um lado). **202** com a situação (abaixo). **409** "Já existe uma
importação em andamento" ou "Nenhuma conta ativa". **400** mais de 1000 excluídos ou datas inválidas. Auditoria
`INSTAGRAM_HISTORY` `event=start`.

## `GET /history` — situação da atual ou da última

Permissão `instagram.review` (todos que veem a fila veem o andamento). **404** se nunca houve importação.

```json
{
  "id": "0193…",
  "status": "RUNNING",
  "from": "2026-01-01",
  "to": "2026-10-31",
  "read": 120,
  "added": 97,
  "existing": 23,
  "excluded": 1,
  "requestedBy": "Juliana Prado",
  "startedAt": "2026-11-16T22:00:00Z",
  "finishedAt": null,
  "error": null
}
```

## `POST /history/cancel` — interromper

Permissão `instagram.settings`. **200** com a situação (`CANCELLED`). **409** se não há importação em andamento.
Auditoria `event=cancel`.

## `POST /posts/generate-batch` — gerar rascunhos em lote

Permissão `instagram.review`.

```json
{ "ids": ["18120202706070233", "C5001"] }
```

**202**:

```json
{ "batchId": "0193…", "total": 2, "queued": 1, "skipped": 1, "perMinute": 4 }
```

Máximo 200 ids por pedido (**400** acima). Pulados = já viraram notícia ou estão ignorados/removidos. Auditoria
`AI_BATCH`.

## `GET /batches/{id}` — andamento do lote

Permissão `instagram.review`. `{ "batchId", "total", "skipped", "generated", "failed", "pending", "requestedBy",
"createdAt" }`.

## Mudanças em `InstagramPostView` (`GET /posts`)

Campo novo `history` (boolean): `true` = veio de importação de histórico. Filtro novo `GET /posts?history=true`.

## Frontend (BFF)

- `src/types/admin.ts`: `InstagramHistoryImport`, `InstagramHistoryPreview`, `InstagramBatch`; `InstagramPost.history`.
- `src/services/admin/instagram-service.ts`: `getInstagramHistory()`, `previewInstagramHistory()`, `getInstagramBatch()`
  (com mocks no modo demonstração).
- `app/admin/(painel)/instagram/actions.ts`: `startInstagramHistory`, `cancelInstagramHistory`,
  `generateInstagramBatch`.
