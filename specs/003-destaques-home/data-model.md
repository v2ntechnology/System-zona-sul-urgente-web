# Modelo de dados: Destaques da home

Migração nova: `V11__home_featured.sql`.

## `news.featured_rank` (existente, V2)

| Regra | Como |
|---|---|
| Posições 1 a 10 | `CHECK (featured_rank BETWEEN 1 AND 10)` (a V2 tinha só `> 0`) |
| Uma notícia por posição | `CREATE UNIQUE INDEX news_featured_rank_unique ON news (featured_rank) WHERE featured_rank IS NOT NULL` |
| Só publicadas | regra no serviço (`AdminNewsService`/`HomeFeaturedService`): salvar recusa não publicadas; despublicar e lixeira zeram |
| Patrocinada nunca na 1 | regra no serviço (salvar e atalho recusam); a manchete automática pula patrocinadas |

Antes de criar o índice, a V11 corrige dados existentes: zera `featured_rank` de notícias não publicadas ou na
lixeira e renumera as restantes em sequência (1, 2, 3…) pela ordem atual.

## Layout da home (como o site usa as posições)

| Posição | Onde aparece |
|---|---|
| 1 | Manchete (vazia = automática: a publicada mais recente não patrocinada) |
| 2–3 | Destaques ao lado da manchete |
| 4–7 | Faixa logo abaixo (completada pelas últimas notícias quando faltam) |
| 8–10 | Reserva (guardadas, não aparecem no desenho atual) |

## Assinatura da ordem (conflito, FR-006)

`signature` = hash (SHA-256, hex, 16 primeiros caracteres) da lista `posição:id` atual. Vai no `GET` e volta no `PUT`;
diferente → 409 com a ordem atual.

## Auditoria

Ação nova `HOME_FEATURE` (entidade `home`, rótulo "Destaques da home"): `diff` com a ordem antes e depois (títulos);
detalhe `shortcut` (`MAIN`/`HIGHLIGHT`/`NONE`) quando vier do atalho. A saída automática ao despublicar/lixeira vai no
detalhe `removedFromFeatured: <posição>` da auditoria `UNPUBLISH`/`DELETE` existente. A V11 recria o `CHECK` de
`audit_logs.action` com todos os valores atuais mais `HOME_FEATURE`.

## Revalidação

Salvar e atalhos: `CACHE_INVALIDATE` com `["home"]` na mesma transação. Despublicar/lixeira: o `NewsChangedEvent`
existente já inclui `home`.
