# Pesquisa: Destaques da home

Decisões da fase 0. Cada uma: **Decisão**, **Por quê**, **Alternativas**.

## R1. Onde fica a ordem do destaque

- **Decisão**: continua na coluna existente `news.featured_rank` (1 = manchete, 2–10 = destaques). A V11 acrescenta a
  restrição `UNIQUE (featured_rank) DEFERRABLE INITIALLY DEFERRED` (NULL continua livre) e o
  `CHECK (featured_rank BETWEEN 1 AND 10)`.
- **Por quê**: o site e os dados de exemplo já leem essa coluna; uma notícia ocupa no máximo uma posição e cada posição
  tem no máximo uma notícia (Entidades da spec). A restrição precisa ser **adiada para o fim da transação**: testado em
  2026-11-16 no PostgreSQL 18, um índice único comum recusa `UPDATE … SET featured_rank = featured_rank + 1` ("duplicate
  key"), porque confere linha a linha — o que quebraria os atalhos e a compactação.
- **Alternativas**: tabela `home_featured(position, news_id)` (mais uma tabela, mesma informação); índice único comum
  com renumeração em dois passos (valores negativos temporários) — funciona, mas espalha o truque por todo lugar que
  desloca posições.

## R2. Manchete automática (FR-009) e patrocinada (FR-010)

- **Decisão**: `NewsReadService.featured()` passa a montar: `main` = a notícia com `featured_rank = 1`; sem ela, a
  publicada mais recente **não patrocinada**. `secondary` = posições 2–10 na ordem, sem repetir a `main`. A resposta
  pública ganha `mainAutomatic: true|false`. Patrocinada nunca recebe a posição 1 (validação na API e índice parcial
  não bastam: regra no serviço).
- **Por quê**: corrige o comportamento atual (sem posição 1, a posição 2 virava manchete sem ninguém escolher) e cumpre
  "a home nunca fica sem manchete".
- **Alternativas**: deixar a home do Next escolher a reserva (a regra ficaria duplicada entre site e API).

## R3. Salvar a ordem inteira e conflito entre duas pessoas (FR-005, FR-006)

- **Decisão**: `PUT /api/v1/admin/home/featured` recebe a lista ordenada de IDs (posição 1 pode ser `null` = automática)
  e a **assinatura** da ordem que a tela carregou (os IDs atuais concatenados, em hash). Em uma transação: confere a
  assinatura (diferente → 409 com a ordem atual), zera os `featured_rank` e grava os novos. A tela mostra o conflito e
  recarrega.
- **Por quê**: troca atômica, sem estado intermediário no site; não precisa de coluna de versão.
- **Alternativas**: salvar posição por posição (estado intermediário visível na home).

## R4. Saída automática do destaque (FR-008)

- **Decisão**: em `AdminNewsService.changeState`, despublicar e enviar para a lixeira zeram o `featured_rank` da
  notícia e **sobem** as de baixo (posição − 1) na mesma transação. Exceção: se quem subiria para a posição 1 for
  **patrocinada**, a posição 1 fica vazia (manchete automática) e só as de 2 em diante sobem (FR-010). Publicar de novo não devolve. "Arquivada" ainda não tem ação no painel; quando tiver, segue a mesma regra
  (registrado como regra no serviço, não depende de tela).
- **Por quê**: a regra fica no único lugar por onde o estado muda; o evento `NewsChangedEvent` já enfileira a
  revalidação com a tag `home`.
- **Alternativas**: limpar ao ler (a posição ficaria "ocupada" por notícia fora do ar).

## R5. Atalhos (FR-007)

- **Decisão**: `POST /api/v1/admin/news/{id}/feature` com `{ "as": "MAIN" | "HIGHLIGHT" | "NONE" }`. MAIN: a notícia vai
  para 1 e as outras descem; HIGHLIGHT: vai sempre para 2 (mesmo com a 1 vazia, que continua automática) e as de 2 em
  diante descem; quem passar de 10 sai. NONE: sai e as de baixo sobem (com a exceção da patrocinada de R4). Patrocinada
  com MAIN → 422. O atalho age sobre a ordem do momento numa transação, sem assinatura: não há o que conflitar.
- **Por quê**: o caso comum ("acabei de publicar, quero na manchete") em um clique, com as regras da tela.

## R6. Atualizar a home (FR-005, SC-002)

- **Decisão**: salvar e os atalhos enfileiram `CACHE_INVALIDATE` com `["home"]` pela `CacheInvalidateJob.enqueue` na
  mesma transação (outbox), como a publicação já faz.
- **Por quê**: reaproveita o caminho testado da spec BE-011.

## R7. Ambiente local: API em contêiner, site fora (FR-012)

- **Decisão**: no `infra/compose.yaml`, `SITE_REVALIDATE_URL: ${SITE_REVALIDATE_URL:-http://web:3000}` e
  `extra_hosts: ["host.docker.internal:host-gateway"]`. Com o site rodando por `npm run dev`, sobe-se a API com
  `SITE_REVALIDATE_URL=http://host.docker.internal:3000`. Testado em 2026-11-16: de dentro do contêiner da API,
  `host.docker.internal:3000` responde 200 e `web:3000` não existe nesse modo.
- **Por quê**: mantém a stack inteira em contêineres funcionando como está e destrava o modo misto, documentado no
  capítulo técnico de desenvolvimento.
- **Alternativas**: trocar o padrão para `host.docker.internal` (quebraria a stack inteira em contêineres).

## R8. Permissão e auditoria

- **Decisão**: `news.publish` (Editor e Administrador) para ver e mudar; ação de auditoria nova `HOME_FEATURE` com a
  ordem antes e depois (títulos e IDs). A V11 recria o `CHECK` de `audit_logs.action`.

## R9. Tela no painel

- **Decisão**: página nova **Destaques** (`/admin/destaques`, item no menu para `news.publish`): as 7 posições que a home
  usa + 3 de reserva; busca de publicadas pela listagem existente (`GET /news?status=PUBLISHED&query=`); reordenar
  arrastando (HTML5 drag and drop) **e** com botões subir/descer (teclado e celular); prévia do topo no desenho da home;
  aviso ao sair com mudanças não salvas.
- **Por quê**: drag and drop sozinho não é acessível nem funciona bem no celular.
- **Aviso ao sair**: `beforeunload` (fechar/recarregar a aba) + confirmação nos links do painel enquanto houver
  mudanças; o "voltar" do navegador fica sem aviso (o App Router não tem evento confiável para isso).

## R10. Impacto na spec 002

- **Decisão**: a 003 usa a **V11**; a migração da 002 passa a ser **V12** (data-model, plano e contrato da 002
  atualizados).
