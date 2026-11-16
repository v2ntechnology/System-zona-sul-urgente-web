# Contrato: destaques da home

Erros em `problem+json`, em português. Chamado só pelo servidor do Next (BFF).

## `GET /api/v1/admin/home/featured`

Permissão `news.publish`.

```json
{
  "slots": [
    { "position": 1, "news": null },
    { "position": 2, "news": { "id": "0193…", "slug": "…", "title": "…", "imageUrl": "…", "category": "Segurança",
        "publishedAt": "2026-11-16T22:14:00Z", "isSponsored": false, "isUrgent": true } }
  ],
  "automaticMain": { "id": "…", "title": "…", "imageUrl": "…", "category": "…", "publishedAt": "…" },
  "signature": "3f9a1c0b2d4e5f61"
}
```

`slots` sempre com as 10 posições (`news: null` = vazia). `automaticMain` só quando a posição 1 está vazia (é a
notícia que a home está mostrando).

## `PUT /api/v1/admin/home/featured`

Permissão `news.publish`.

```json
{ "ids": [null, "0193…", "0194…"], "signature": "3f9a1c0b2d4e5f61" }
```

`ids[0]` = posição 1 (`null` = manchete automática); até 10 itens; posições depois do último ficam vazias.

- **200** com o mesmo corpo do `GET` (ordem nova).
- **409** "Os destaques mudaram" — outra pessoa salvou depois que a tela abriu; corpo traz a ordem atual em `current`.
- **400** `InvalidFieldsException`: mais de 10, ID repetido.
- **422** notícia não publicada, inexistente, ou patrocinada na posição 1 (mensagem diz qual).
- Auditoria `HOME_FEATURE`; `CACHE_INVALIDATE ["home"]`.

## `POST /api/v1/admin/news/{id}/feature`

Permissão `news.publish`. `{ "as": "MAIN" | "HIGHLIGHT" | "NONE" }` → **200** com o corpo do `GET`. **422** notícia não
publicada ou patrocinada com `MAIN`. **404** notícia inexistente.

## Público: `GET /api/v1/public/news/featured` (existente, ajustado)

```json
{ "main": { … }, "mainAutomatic": true, "secondary": [ … ] }
```

`main` existe sempre que houver qualquer notícia publicada não patrocinada. **204** só sem nenhuma publicada.

## Listagem do painel (`GET /api/v1/admin/news`, existente)

`AdminNewsRow` ganha `featuredRank` (`null` = fora do destaque), para a listagem mostrar o selo e os atalhos certos.

## Frontend (BFF)

- `src/types/admin.ts`: `HomeFeatured`, `HomeFeaturedSlot`; `AdminNewsRow.featuredRank`.
- `src/types/news.ts`: `HomeFeatured.mainAutomatic` (público).
- `src/services/admin/home-featured-service.ts` (novo, com mock no modo demonstração).
- `app/admin/(painel)/destaques/{page.tsx,actions.ts}` (novos); `app/admin/(painel)/noticias/actions.ts` ganha
  `featureNews(id, as)`.
