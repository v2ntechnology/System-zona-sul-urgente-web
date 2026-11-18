---
description: "Tarefas da spec 002 — importar posts antigos do Instagram"
---

# Tarefas: Importar posts antigos do Instagram

**Entrada**: `specs/002-importar-posts-antigos/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Testes**: incluídos — constituição VIII (teste de integração com PostgreSQL real para cada regra do backend).

**Organização**: US1 trazer para a fila (P1) · US2 acompanhar e interromper (P1) · US3 gerar rascunhos em lote (P2).

## Formato: `[ID] [P?] [História] Descrição`

## Caminhos (abreviações)

- `{api}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/java/br/com/zonasulurgente/api`
- `{res}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/resources`
- `{test}` = `System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api`
- `{fe}` = `System-Zona-Sul-Urgente-Web-Frontend/src`
- `{e2e}` = `System-Zona-Sul-Urgente-Web-Frontend/e2e`

---

## Fase 1: Preparação

- [ ] T001 Criar `{res}/db/migration/V13__instagram_history.sql` conforme data-model.md: tabela `instagram_history_imports`
  (`id uuid PRIMARY KEY DEFAULT uuidv7()`, `ig_user_id varchar(64) NOT NULL`, `from_date date`, `to_date date`,
  `excluded_ids jsonb NOT NULL DEFAULT '[]'`, `status varchar(12) NOT NULL CHECK (status IN ('RUNNING','COMPLETED',
  'CANCELLED','FAILED'))`, `read_count`, `added_count`, `existing_count`, `excluded_count integer NOT NULL DEFAULT 0`,
  `requested_by uuid REFERENCES users(id)`, `started_at timestamptz NOT NULL DEFAULT now()`, `finished_at timestamptz`,
  `error varchar(500)`); índice único parcial `(status) WHERE status = 'RUNNING'`; em `instagram_posts`:
  `history_import_id uuid REFERENCES instagram_history_imports(id)` e `source_checked_at timestamptz`; tabelas
  `instagram_generation_batches` (`id uuid PK DEFAULT uuidv7()`, `requested_by uuid REFERENCES users(id)`,
  `requested_by_name varchar(120) NOT NULL`, `total integer NOT NULL`, `skipped integer NOT NULL`, `created_at
  timestamptz NOT NULL DEFAULT now()`) e `instagram_generation_batch_items` (`batch_id` → batches ON DELETE CASCADE,
  `post_id varchar(64)` → instagram_posts ON DELETE CASCADE, PK `(batch_id, post_id)`); recriar o `CHECK
  audit_logs_action_check` com os valores da V12 (spec 004) mais `INSTAGRAM_HISTORY` e `AI_BATCH`.
- [ ] T002 [P] Acrescentar `INSTAGRAM_HISTORY` e `AI_BATCH` em `{api}/audit/AuditAction.java`; em
  `{api}/instagram/InstagramProperties.java` acrescentar `batchPerMinute` (padrão `4`), `oldNewsChecksPerSync` (`20`) e
  `historyMaxExcluded` (`1000`), com o bloco comentado em `{res}/application.yml`.
- [ ] T003 [P] Em `{api}/jobs/JobQueue.java` acrescentar `enqueue(String type, Object payload, OffsetDateTime runAt,
  int maxAttempts)` (a atual continua); em `{api}/jobs/JobHandler.java` um método `default void handle(JsonNode payload,
  int attempt, int maxAttempts)` que chama o atual, e o `{api}/jobs/JobWorker.java` passa a chamar esse (para a T021
  saber quando é a última tentativa); cobrir em `{test}/jobs/JobQueueTests.java` (job agendado não é pego antes da hora;
  `max_attempts` gravado; o handler recebe a tentativa certa).

---

## Fase 2: Base

- [ ] T004 Ampliar `{test}/instagram/FakeGraphServer.java`: cursores opacos como os da Meta, histórico de centenas de
  posts com datas espalhadas, contagem de chamadas por endpoint (lista, post por ID, imagem) e erro só numa página
  específica (para testar nova tentativa no meio da importação).
- [ ] T005 Em `{api}/instagram/InstagramImportJob.java` aceitar no payload `sources` (lista de `{position, url, kind}`) e
  `altText`: baixar por esses endereços e só chamar `mediaById` se o download falhar (endereço expirado — research.md
  R4); não gerar rascunho quando o post tem `history_import_id` (R3). Em `{api}/instagram/InstagramSyncService.java`,
  mandar `sources`/`altText` no payload também na varredura normal. Cobrir em `{test}/instagram/InstagramSyncTests.java`
  (varredura normal não chama `GET /{media-id}`; com endereço expirado, chama).
- [ ] T006 Em `{api}/instagram/InstagramRepository.java`: CRUD de `instagram_history_imports` (criar `RUNNING`, ler a
  atual/última, incrementar contadores, mudar situação), `history_import_id` na inserção de post e no `InstagramPostView`
  (campo `history`), filtro `history=true` na listagem, itens de lote e o andamento do lote; contagens (`counts()`) sem
  os antigos sem notícia em `NEW`, mais a chave `HISTORY` com eles (FR-016, research.md R12).

**Checkpoint**: base pronta.

---

## Fase 3: História 1 — Trazer posts antigos para a fila (P1) 🎯 MVP

**Objetivo**: o Administrador escolhe período (e desmarca posts, se quiser) e os posts entram com foto, sem rascunho.

**Teste independente**: importar um período da conta reserva e ver os posts na fila com foto, marcados "Antigo", e
nenhuma notícia nova.

### Testes da História 1

- [ ] T007 [P] [US1] Criar `{test}/instagram/InstagramHistoryTests.java` (`@SpringBootTest` + `FakeGraphServer`,
  `zsu.jobs.enabled=false`, jobs rodados com `JobWorker.runOnce()`): `GET /history/preview` devolve só posts do período,
  com `inQueue`; `POST /history` com período importa só o período, desmarcados ficam de fora, posts com foto e
  `history_import_id`; **nenhuma notícia criada**; post já na fila (manual ou sincronizado) não duplica e ganha a foto se
  faltava; repetir a importação do mesmo período não duplica (`existing` = todos); Editor e Repórter → 403 em preview,
  iniciar e interromper; sem conta ativa → 409; `from` > `to` ou datas no futuro → 400; mais de 1000 excluídos → 400;
  antigos que viraram notícia são conferidos (legenda alterada → `CHANGED_AT_SOURCE`; apagado → `REMOVED_AT_SOURCE`), no
  máximo 20 por varredura, em rodízio por `source_checked_at`, e falha só nessa parte não conta como falha da varredura;
  depois de importar, `GET /posts/counts` não soma os antigos sem rascunho em `NEW` e traz `HISTORY` com eles (FR-016).

### Implementação da História 1

- [ ] T008 [US1] Criar `{api}/instagram/InstagramHistoryService.java`: `preview(from, to, after)` (uma página da Meta
  dentro do período, com `inQueue`), `start(from, to, excludedIds, user)` (valida, cria `RUNNING`, enfileira a primeira
  `INSTAGRAM_HISTORY_PAGE`, auditoria `INSTAGRAM_HISTORY` `event=start`), `view()`.
- [ ] T009 [US1] Criar `{api}/instagram/InstagramHistoryPageJob.java` (`JobHandler`, `INSTAGRAM_HISTORY_PAGE`, payload
  `{importId, after}`): sai sem fazer nada se a importação não está `RUNNING` ou a conta mudou; lê uma página, pula os
  posts mais novos que `to`, para ao passar de `from` (`COMPLETED`), grava os novos com `history_import_id` e enfileira
  `INSTAGRAM_IMPORT` com `sources` (T005), liga os existentes pelo link (ganham foto se faltava), atualiza os contadores e
  enfileira a próxima página; última página → `COMPLETED` + auditoria `event=completed`.
- [ ] T010 [US1] Em `{api}/instagram/InstagramSyncService.java`, depois da parte dos posts novos, conferir até
  `oldNewsChecksPerSync` posts antigos **com notícia** (fora da janela de 30 dias), pelo mais antigo `source_checked_at`,
  com `mediaById` (legenda diferente da última vista → `CHANGED_AT_SOURCE`; não existe → `REMOVED_AT_SOURCE`); erro só
  aqui é logado e não marca a varredura como falha (research.md R9).
- [ ] T011 [US1] Em `{api}/instagram/AdminInstagramController.java`: `GET /history/preview`, `POST /history` (202),
  `GET /history` (`instagram.review`; 404 sem histórico), com `instagram.settings` nas escritas e no preview.
- [ ] T012 [P] [US1] Em `{fe}/types/admin.ts`: `InstagramHistoryImport`, `InstagramHistoryPreview`
  (`items[]`, `after`), `InstagramPost.history`; em `{fe}/services/admin/instagram-service.ts`:
  `getInstagramHistory()` e `previewInstagramHistory(from, to, after)` com mocks no modo demonstração (+ teste em
  `{fe}/services/admin/instagram-service.test.ts`); em `{fe}/app/admin/(painel)/instagram/actions.ts`:
  `startInstagramHistory({from, to, excludedIds})`.
- [ ] T013 [US1] Criar `{fe}/components/admin/instagram-history.tsx`: painel "Importar posts antigos" (só
  `instagram.settings`): período (de/até ou "todo o histórico"), "Ver a lista" que carrega a pré-visualização aos poucos
  (miniatura, data, começo da legenda, "já na fila"), desmarcar, confirmar; mostrar quantos posts e quantos desmarcados;
  miniatura que não carregar (endereço da Meta expirado) vira um marcador sem imagem.
- [ ] T014 [US1] Em `{fe}/components/admin/instagram-queue.tsx` e `{fe}/app/admin/(painel)/instagram/page.tsx`: selo
  "Antigo", nota "Post antigo: clique em Gerar agora ou gere em lote", filtro "Antigos" (`?history=1`) com a contagem
  `HISTORY`, "pedem ação" sem os antigos (FR-016), e o painel da T013 na página para o Administrador; no Dashboard
  (`{fe}/services/admin/admin-service.ts`, `instagramNew`), usar a contagem sem os antigos.

**Checkpoint**: H1 funcionando.

---

## Fase 4: História 2 — Acompanhar e interromper (P1)

**Objetivo**: andamento visível e interrupção em menos de 1 minuto.

**Teste independente**: iniciar o histórico inteiro, ver os números subirem, interromper e conferir que o que entrou fica.

### Testes da História 2

- [ ] T015 [P] [US2] Acrescentar em `{test}/instagram/InstagramHistoryTests.java`: contadores avançam a cada página;
  `POST /history/cancel` → `CANCELLED` e nenhuma página nova roda; segunda importação com uma `RUNNING` → 409; desligar ou
  trocar a conta → `CANCELLED`; acesso revogado no meio → `FAILED` com motivo e conexão `REVOKED` (regra da spec 001);
  limite/5xx numa página → nova tentativa e a importação continua; job de página DEAD → `FAILED`; a varredura de 15 min
  continua trazendo posts novos durante a importação (SC-006); auditoria `cancel`/`failed`.

### Implementação da História 2

- [ ] T016 [US2] Em `{api}/instagram/InstagramHistoryService.java`: `cancel(user)` (`CANCELLED`, auditoria
  `event=cancel`); em `{api}/instagram/InstagramHistoryPageJob.java`: `AccessRevokedException` → `FAILED` + marcar a
  conexão `REVOKED`; `TransientGraphException` → relançar (a fila tenta de novo); última tentativa → `FAILED`; em
  `{api}/instagram/InstagramConnectionService.java`: desligar/trocar conta cancela a importação em andamento.
- [ ] T017 [US2] `POST /history/cancel` em `{api}/instagram/AdminInstagramController.java` (`instagram.settings`; 409 sem
  importação em andamento).
- [ ] T018 [US2] Em `{fe}/components/admin/instagram-history.tsx`: andamento (situação, lidos, novos, já na fila,
  desmarcados, início/fim, motivo da falha), atualizado a cada 5 s enquanto `RUNNING` (`router.refresh()`), botão
  **Interromper** (com confirmação) e `cancelInstagramHistory()` em `{fe}/app/admin/(painel)/instagram/actions.ts`.

**Checkpoint**: H1 + H2 = MVP.

---

## Fase 5: História 3 — Gerar rascunhos em lote (P2)

**Objetivo**: marcar vários posts e gerar rascunhos no ritmo da IA.

**Teste independente**: marcar 10 posts antigos, gerar em lote e ver 10 rascunhos sem duplicar.

### Testes da História 3

- [ ] T019 [P] [US3] Criar `{test}/instagram/InstagramBatchTests.java`: `POST /posts/generate-batch` enfileira um
  `INSTAGRAM_GENERATE` por post elegível com `run_at` escalonado (`i × 60 / batch-per-minute` s) e pula os que já viraram
  notícia, ignorados ou removidos; mais de 200 → 400; Comercial → 403, Repórter → 202; cada job cria o rascunho com foto
  e crédito (como a spec 001) em nome de "Lote de <nome>"; o rascunho **nunca** nasce urgente, mesmo com a IA sugerindo
  (C1); nunca duas notícias por post; IA com limite (429 / `AiUnavailableException`) → o job falha e tenta de novo sem
  marcar "Erro"; na **última tentativa** o post vira "Erro" com a mensagem de reprocessar (G1); saída inválida
  (`AiOutputException`) → "Erro" com Reprocessar; `GET /batches/{id}` mostra gerados, erros, pendentes, pulados; auditoria `AI_BATCH`.

### Implementação da História 3

- [ ] T020 [US3] Criar `{api}/instagram/BatchActor.java` (ator "Lote de <nome>", `id` nulo, permissões `news.create`,
  `news.edit.own`, `tags.manage` — **sem** `news.mark_urgent`, para o rascunho do lote nunca nascer urgente) e `{api}/instagram/InstagramBatchService.java` (`create(ids, user)` e `progress(batchId)`).
- [ ] T021 [US3] Criar `{api}/instagram/InstagramGenerateJob.java` (`INSTAGRAM_GENERATE`, `max_attempts = 48`): pula se o
  post já tem notícia ou não está `NEW`/`ERROR`; chama a geração de `{api}/instagram/InstagramQueueService.java`, que ganha
  uma variante que **relança** `AiUnavailableException` (para a fila tentar de novo) em vez de marcar "Erro"; na última
  tentativa (`attempts` = `max_attempts` − 1, informado ao handler), marca "Erro" com "A IA não respondeu depois de
  várias tentativas; reprocesse" em vez de relançar.
- [ ] T022 [US3] Em `{api}/instagram/AdminInstagramController.java`: `POST /posts/generate-batch` (202) e
  `GET /batches/{id}` (`instagram.review`).
- [ ] T023 [US3] Em `{fe}/components/admin/instagram-queue.tsx` (visão "Fila"): caixa de seleção nos posts sem notícia,
  "Selecionar todos os antigos da página" (no máximo 200, o limite do lote), botão **Gerar rascunhos (N)**, andamento do lote ("3 de 10 gerados · 1 erro ·
  próximos em 15 s"); `generateInstagramBatch(ids)` e `getInstagramBatch(id)` em
  `{fe}/app/admin/(painel)/instagram/actions.ts` e `{fe}/services/admin/instagram-service.ts`; tipos em
  `{fe}/types/admin.ts`.

**Checkpoint**: todas as histórias funcionando.

---

## Fase 6: Acabamento

- [ ] T024 [P] Teste de ponta a ponta no modo demonstração em `{e2e}/admin.spec.ts`: painel "Importar posts antigos"
  (período, lista, desmarcar, importar "simulado") e seleção em lote na fila ("simulado").
- [ ] T025 [P] Documentação: `docs/documentacao/usuario/05-instagram-e-ia.md` (importar histórico, andamento,
  interromper, gerar em lote, selo Antigo, conferência dos antigos que viraram notícia);
  `docs/documentacao/tecnico/10-arquitetura.md` (jobs `INSTAGRAM_HISTORY_PAGE`/`INSTAGRAM_GENERATE`, ritmo do lote,
  rodízio) e o bloco `zsu.instagram` novo.
- [ ] T026 Rodar `./mvnw verify` e `npm run format:check && npm run lint && npm run typecheck && npm test && npm run
  test:e2e`; corrigir o que falhar.
- [ ] T027 Validar com a conta reserva (434 posts) os 8 cenários de `specs/002-importar-posts-antigos/quickstart.md`,
  medindo o tempo do histórico inteiro (SC-001, < 30 min) e da interrupção (SC-004, < 1 min); registrar no quickstart.
- [ ] T028 Atualizar `docs/backlog.md` (BE-024 → Concluído) e `docs/changelog.md` pelo `/encerrar-dia`.

---

## Dependências e ordem

- Fase 1 → Fase 2 → US1 → US2 → US3 → Acabamento.
- US2 depende do job de página da US1. US3 depende só da Fase 1–2 (pode ser feita junto da US1/US2).

### Paralelismo

- Fase 1: T002 e T003 juntas.
- US1: T007 e T012 em paralelo; T013/T014 depois da T012.
- US2: T015 em paralelo com a T016.
- US3: T019 em paralelo; T020–T023 em sequência.
- Acabamento: T024 e T025 em paralelo.

## Estratégia

1. **MVP = US1 + US2**: trazer o histórico com foto, acompanhar e interromper — cenários 1–5 e 8.
2. **Incremento**: US3 (lote) — cenários 6–7.
