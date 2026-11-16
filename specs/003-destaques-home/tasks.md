---
description: "Tarefas da spec 003 — destaques da home"
---

# Tarefas: Destaques da home

**Entrada**: `specs/003-destaques-home/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Testes**: incluídos — a constituição (VIII) exige teste de integração com PostgreSQL real para cada regra do backend.

**Organização**: por história (US1 montar o topo · US3 ajuste automático · US2 atalhos). US1 e US3 são P1; US2 é P2.

## Formato: `[ID] [P?] [História] Descrição`

## Caminhos (abreviações)

- `{api}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/java/br/com/zonasulurgente/api`
- `{res}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/resources`
- `{test}` = `System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api`
- `{fe}` = `System-Zona-Sul-Urgente-Web-Frontend/src`
- `{e2e}` = `System-Zona-Sul-Urgente-Web-Frontend/e2e`

---

## Fase 1: Preparação

- [ ] T001 Criar `{res}/db/migration/V11__home_featured.sql`: (1) zerar `featured_rank` de notícias com
  `status <> 'PUBLISHED' OR deleted_at IS NOT NULL`; (2) renumerar as restantes em sequência 1, 2, 3… pela ordem atual
  (`row_number() OVER (ORDER BY featured_rank)`); (3) `ALTER TABLE news ADD CONSTRAINT news_featured_rank_range CHECK
  (featured_rank BETWEEN 1 AND 10)`; (4) `ALTER TABLE news ADD CONSTRAINT news_featured_rank_unique UNIQUE
  (featured_rank) DEFERRABLE INITIALLY DEFERRED` (adiada: deslocar posições ±1 numa transação precisa disso — research.md
  R1); (5) recriar o `CHECK audit_logs_action_check` com todos os valores da V10 mais
  `HOME_FEATURE`. Comentários em português citando a spec 003.
- [ ] T002 [P] Acrescentar `HOME_FEATURE` em `{api}/audit/AuditAction.java`.
- [ ] T003 [P] Em `infra/compose.yaml`, no serviço `api`: `SITE_REVALIDATE_URL: ${SITE_REVALIDATE_URL:-http://web:3000}` e
  `extra_hosts: ["host.docker.internal:host-gateway"]`, com comentário explicando o modo misto (site por `npm run dev`:
  subir a API com `SITE_REVALIDATE_URL=http://host.docker.internal:3000`) — research.md R7.

---

## Fase 2: Base

- [ ] T004 Em `{api}/news/admin/AdminNewsRepository.java`: ler a ordem do destaque (`featured_rank`, id, título, slug,
  foto, editoria, `published_at`, `is_sponsored`, `is_urgent`, status, `deleted_at`), gravar a ordem inteira (zerar e
  regravar numa transação; a restrição única é adiada para o fim da transação), deslocar posições (+1 a partir de uma
  posição, cortando o que passar de 10), tirar uma notícia e **compactar** (posições abaixo − 1, mas se quem subiria
  para a 1 for patrocinada, a 1 fica vazia e só sobem as de 2 em diante), e incluir `featured_rank` na leitura da
  listagem. Teste em `{test}/news/HomeFeaturedApiTests.java` cobrindo o deslocamento +1 e −1 sem erro de chave
  duplicada.
- [ ] T005 [P] Em `{api}/news/admin/AdminNewsRow.java` acrescentar `Integer featuredRank` (nulo = fora do destaque) e
  preencher no mapeamento do repositório; refletir em `{fe}/types/admin.ts` (`AdminNewsRow.featuredRank?: number | null`).

**Checkpoint**: base pronta.

---

## Fase 3: História 1 — Montar o topo da home no painel (P1) 🎯 MVP

**Objetivo**: Editor/Administrador escolhe manchete e destaques, reordena, vê prévia e salva; a home atualiza.

**Teste independente**: escolher uma publicada como manchete, salvar e ver a home mudar em < 1 min.

### Testes da História 1

- [ ] T006 [P] [US1] Criar `{test}/news/HomeFeaturedApiTests.java` (`@SpringBootTest`, `@AutoConfigureMockMvc`,
  `@Import(TestcontainersConfiguration.class)`, `@ActiveProfiles("local")`, `@Transactional`, sessões por
  `TestSessions.bearer`): `GET /api/v1/admin/home/featured` devolve 10 posições, `signature` e `automaticMain` quando a 1
  está vazia; `PUT` com ordem nova grava tudo e devolve a ordem nova; enfileira `CACHE_INVALIDATE` com `home`;
  auditoria `HOME_FEATURE` com antes/depois; assinatura antiga → 409 com `current`; ID repetido ou mais de 10 → 400;
  notícia não publicada (rascunho da IA incluído) → 422; patrocinada na posição 1 → 422 (nas outras, aceita);
  Repórter (`ana.ribeiro`), Comercial (`sandra.lopes`) → 403; Editor (`rafael.duarte`) e Administradora → 200.
- [ ] T007 [P] [US1] Acrescentar em `{test}/news/PublicNewsApiTests.java`: `GET /api/v1/public/news/featured` com posição 1
  vazia devolve `main` = publicada mais recente **não patrocinada** e `mainAutomatic: true`, sem repetir a `main` em
  `secondary`; com posição 1 preenchida, `mainAutomatic: false`; posições 2..n vêm em ordem.

### Implementação da História 1

- [ ] T008 [US1] Criar `{api}/news/admin/HomeFeaturedService.java`: `view()` (10 posições, `automaticMain`, `signature` =
  SHA-256 hex, 16 primeiros caracteres, da lista `posição:id`), `save(ids, signature, user)` (validação: até 10, sem
  repetidos, só publicadas e fora da lixeira, patrocinada nunca na posição 1; assinatura diferente → `ApiException` 409
  com a ordem atual; grava tudo na mesma transação, `CacheInvalidateJob.enqueue(List.of("home"))` e auditoria
  `HOME_FEATURE` com os títulos antes/depois).
- [ ] T009 [US1] Criar `{api}/news/admin/AdminHomeFeaturedController.java` (`/api/v1/admin/home/featured`, `GET` e `PUT`,
  `@PreAuthorize("hasAuthority('news.publish')")`); o 409 leva a ordem atual no corpo (`current`).
- [ ] T010 [US1] Em `{api}/news/application/NewsReadService.java` (`featured()`) e no record `Featured`: `main` = posição 1
  ou, sem ela, a publicada mais recente não patrocinada; `mainAutomatic`; `secondary` = posições 2–10 sem repetir a
  `main`; refletir `mainAutomatic` em `HomeFeatured` de `{fe}/services/news-service.ts` e no mock.
- [ ] T011 [P] [US1] Criar `{fe}/lib/home-featured.ts` (regras puras: mover para cima/baixo, pôr numa posição deslocando,
  tirar e compactar, cortar na 10, bloquear patrocinada na 1, `layoutOf(position)` → "Manchete" / "Destaque ao lado" /
  "Faixa" / "Reserva") e `{fe}/lib/home-featured.test.ts`.
- [ ] T012 [US1] Criar `{fe}/services/admin/home-featured-service.ts` (`getHomeFeatured()`; mock no modo demonstração com
  o topo dos dados de exemplo) + teste, e os tipos `HomeFeatured`/`HomeFeaturedSlot` em `{fe}/types/admin.ts`.
- [ ] T013 [US1] Criar `{fe}/app/admin/(painel)/destaques/actions.ts` (`saveHomeFeatured(ids, signature)`,
  `searchPublishedNews(query)` usando a listagem existente com `status=PUBLISHED`; sem API → "simulado").
- [ ] T014 [US1] Criar `{fe}/components/admin/home-featured-editor.tsx`: as 10 posições agrupadas como na home
  (Manchete · Destaques ao lado · Faixa · Reserva), "Manchete automática: <título>" quando a 1 está vazia, busca de
  publicadas, arrastar (HTML5) e botões subir/descer/tirar acessíveis por teclado, prévia do topo no desenho da home,
  aviso de patrocinada (não entra na 1), salvar com a assinatura, tratamento do 409 ("Os destaques mudaram" + recarregar),
  aviso ao sair com mudanças não salvas: `beforeunload` (fechar/recarregar a aba) e confirmação ao clicar em links do
  painel; o "voltar" do navegador fica sem aviso (research.md R9).
- [ ] T015 [US1] Criar `{fe}/app/admin/(painel)/destaques/page.tsx` (só `news.publish`; senão `notFound()`) e o item
  "Destaques" em `{fe}/config/admin-navigation.ts` (rota `adminRoutes.featured = "/admin/destaques"`, rótulo de trilha).

**Checkpoint**: H1 funcionando.

---

## Fase 4: História 3 — O destaque se ajusta sozinho (P1)

**Objetivo**: notícia que sai do ar sai do destaque e as de baixo sobem.

**Teste independente**: despublicar a manchete e ver a próxima (ou a automática) na home.

### Testes da História 3

- [ ] T016 [P] [US3] Acrescentar em `{test}/news/HomeFeaturedApiTests.java`: despublicar a posição 1 → as de baixo sobem
  (2→1, 3→2…) e a auditoria `UNPUBLISH` traz `removedFromFeatured: 1`; com a posição 2 **patrocinada**, despublicar a 1
  deixa a 1 vazia (automática) e a patrocinada continua na 2; mandar para a lixeira a posição 3 → 4→3…; republicar não
  volta ao destaque; sem nenhuma escolhida, o público mostra a manchete automática.

### Implementação da História 3

- [ ] T017 [US3] Em `{api}/news/admin/AdminNewsService.java` (`changeState`, casos `UNPUBLISHED` e `DELETED`): se a notícia
  tem `featured_rank`, tirar e compactar na mesma transação (repositório da T004, com a exceção da patrocinada) e
  registrar `removedFromFeatured` no detalhe da auditoria existente; o `NewsChangedEvent` já inclui a tag `home`. (Não há
  ação "arquivar" no painel; quando houver, chamar a mesma compactação.)

**Checkpoint**: H1 + H3 = MVP.

---

## Fase 5: História 2 — Atalho a partir da notícia (P2)

**Objetivo**: Colocar como manchete / Colocar nos destaques / Tirar do destaque em 1 clique.

**Teste independente**: na listagem, "Colocar como manchete" numa publicada e ver a home mudar.

### Testes da História 2

- [ ] T018 [P] [US2] Acrescentar em `{test}/news/HomeFeaturedApiTests.java`: `POST /api/v1/admin/news/{id}/feature`
  `MAIN` → posição 1 e as outras descem, a 10ª sai; `HIGHLIGHT` → posição 2, as de 2 em diante descem — também com a
  posição 1 vazia, que continua automática; `NONE` → sai e as de baixo sobem; atalho sem assinatura sobre a ordem do
  momento; patrocinada com `MAIN` → 422 (com `HIGHLIGHT`, aceita); rascunho → 422; Repórter → 403; auditoria
  `HOME_FEATURE` com `shortcut`; `CACHE_INVALIDATE` com `home`.

### Implementação da História 2

- [ ] T019 [US2] Em `{api}/news/admin/HomeFeaturedService.java` acrescentar `feature(id, as, user)` (regras de
  research.md R5, reaproveitando a validação e a gravação de `save`) e em `{api}/news/admin/AdminNewsController.java` o
  `POST /{id}/feature` com `@PreAuthorize("hasAuthority('news.publish')")`.
- [ ] T020 [US2] Em `{fe}/app/admin/(painel)/noticias/actions.ts` acrescentar `featureNews(id, as)`; em
  `{fe}/components/admin/news-table.tsx` mostrar o selo "Manchete"/"Destaque N" e os itens do menu (só publicadas; sem
  "Colocar como manchete" para patrocinada; só para quem tem `news.publish`); em
  `{fe}/components/admin/editor/news-editor.tsx` os mesmos atalhos para notícia publicada.

**Checkpoint**: todas as histórias funcionando.

---

## Fase 6: Acabamento

- [ ] T021 [P] Teste de ponta a ponta no modo demonstração em `{e2e}/admin.spec.ts`: abrir Destaques, ver as posições e a
  manchete do exemplo, subir/descer uma notícia, salvar ("simulado"); atalho "Colocar como manchete" na listagem.
- [ ] T022 [P] Documentação: `docs/documentacao/usuario/04-noticias.md` (seção "Destaques da home": posições, manchete
  automática, patrocinada, atalhos, saída automática) e o passo 5 do fluxo no capítulo 5; `03-acesso-e-perfis.md`
  (linha "Destaques da home" na tabela de perfis); `docs/documentacao/tecnico/10-arquitetura.md` (fluxo do destaque) e
  `11-desenvolvimento.md` (modo misto com `SITE_REVALIDATE_URL=http://host.docker.internal:3000`).
- [ ] T023 Rodar `./mvnw verify` e, no frontend, `npm run format:check && npm run lint && npm run typecheck && npm test &&
  npm run test:e2e`; corrigir o que falhar.
- [ ] T024 Validar os 8 cenários de `specs/003-destaques-home/quickstart.md`, medindo o tempo de "salvar → home mudou"
  (SC-002, < 1 min) e de trocar a manchete pelo atalho (SC-001, < 30 s), no ambiente local (API em contêiner com
  `SITE_REVALIDATE_URL=http://host.docker.internal:3000`, site por `npm run dev`); registrar o resultado no quickstart.
- [ ] T025 Atualizar `docs/backlog.md` (item novo do painel para destaques da home → Concluído) e `docs/changelog.md`
  pelo `/encerrar-dia`.

---

## Dependências e ordem

- Fase 1 → Fase 2 → US1 → US3 → US2 → Acabamento.
- US3 depende só da Fase 2 (compactação no repositório) e pode correr junto da US1; US2 depende do `HomeFeaturedService`
  da US1.

### Paralelismo

- Fase 1: T002 e T003 juntas, depois da T001 ou em paralelo a ela.
- US1: T006, T007 e T011 em paralelo; T012–T015 depois da T008/T009.
- US3: T016 em paralelo com a US1.
- Acabamento: T021 e T022 em paralelo.

## Estratégia

1. **MVP = US1 + US3** (as duas P1): montar o topo e nunca mostrar notícia fora do ar. Validar com os cenários 1–4, 7 e 8.
2. **Incremento**: US2 (atalhos) — cenários 5 e 6.
