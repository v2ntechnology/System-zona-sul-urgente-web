---
description: "Tarefas da spec 001 — conexão com a conta do Instagram"
---

# Tarefas: Conexão com a conta do Instagram

**Entrada**: `specs/001-conexao-instagram/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Testes**: incluídos — a constituição (VIII) exige teste de integração com PostgreSQL real para cada regra do backend
e o CI verde para concluir uma tarefa.

**Organização**: por história da spec (US1–US4), cada uma testável sozinha.

## Formato: `[ID] [P?] [História] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[USn]**: história da spec

## Caminhos (abreviações usadas nas tarefas)

- `{api}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/java/br/com/zonasulurgente/api`
- `{res}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/resources`
- `{test}` = `System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api`
- `{fe}` = `System-Zona-Sul-Urgente-Web-Frontend/src`
- `{e2e}` = `System-Zona-Sul-Urgente-Web-Frontend/e2e`

---

## Fase 1: Preparação

**Objetivo**: schema, configuração e auditoria que todas as histórias usam.

- [X] T001 Criar a migração `{res}/db/migration/V10__instagram_connection.sql` conforme data-model.md: tabela
  `instagram_connection` (`id smallint PRIMARY KEY CHECK (id = 1)`, `ig_user_id varchar(64) NOT NULL`,
  `username varchar(100) NOT NULL`, `token_cipher text NOT NULL`, `token_last4 varchar(4) NOT NULL`,
  `token_expires_at timestamptz` nulo = não vence, `status varchar(10) NOT NULL CHECK (status IN ('ACTIVE','REVOKED'))`,
  `connected_by uuid REFERENCES users(id)`, `connected_at timestamptz NOT NULL`, `backfill_since timestamptz NOT NULL`,
  `last_sync_at timestamptz`, `last_success_at timestamptz`, `last_error varchar(500)`,
  `failures integer NOT NULL DEFAULT 0`);
  em `instagram_posts` adicionar `ig_media_id varchar(64) UNIQUE`, `ig_user_id varchar(64)`,
  `media_product_type varchar(20)`, `needs_photo boolean NOT NULL DEFAULT false`,
  `main_media_id uuid REFERENCES media_assets(id)`; tabela `instagram_post_media` (`post_id varchar(64) REFERENCES
  instagram_posts(id) ON DELETE CASCADE`, `position smallint`, `media_asset_id uuid NOT NULL REFERENCES media_assets(id)`,
  `kind varchar(12) NOT NULL CHECK (kind IN ('IMAGE','VIDEO_COVER'))`, `PRIMARY KEY (post_id, position)`); recriar o
  `CHECK` de `audit_logs.action` (criado na `V9__audit_logs.sql`) com todos os valores atuais mais `INSTAGRAM_CONNECT`,
  `INSTAGRAM_DISCONNECT`, `INSTAGRAM_ACCESS_LOST`. Comentários em português citando BE-013 e a spec 001.
- [X] T002 [P] Criar `{api}/instagram/InstagramProperties.java` (`@ConfigurationProperties("zsu.instagram")`, record
  com `@DefaultValue`: `graphBaseUrl = https://graph.facebook.com/v27.0`, `syncInterval = 15m`, `backfill = 7d`,
  `reconcileWindow = 30d`, `failuresBeforeAlert = 3`, `timeout = 20s`) e o bloco comentado `zsu.instagram` em
  `{res}/application.yml` (sem variável de ambiente nova).
- [X] T003 [P] Acrescentar `INSTAGRAM_CONNECT`, `INSTAGRAM_DISCONNECT`, `INSTAGRAM_ACCESS_LOST` em
  `{api}/audit/AuditAction.java` (o banco aceita os valores pelo `CHECK` recriado na T001; hoje não há mapeamento de
  rótulos de auditoria no frontend, então nada a mudar lá).

---

## Fase 2: Base (bloqueia as histórias)

**Objetivo**: cliente da Meta, ator de sistema, repositório e o servidor falso para testes.

- [X] T004 Criar `{test}/instagram/FakeGraphServer.java`: `HttpServer` local (mesmo padrão de
  `{test}/ai/GeminiEditorialAiTests.java`) que imita `GET /{igUserId}`, `GET /{igUserId}/media` (com `paging.next`),
  `GET /{mediaId}` e serve imagens JPEG reais pequenas para download; permite configurar posts, legendas, posts
  apagados, respostas de erro (`{"error":{"code":190}}`, 5xx, `code 4/17/32/613`) e registra o cabeçalho
  `Authorization` recebido.
- [X] T005 Criar `{api}/instagram/InstagramGraphClient.java` (`RestClient`, `Authorization: Bearer`, timeout de
  `InstagramProperties.timeout`): `account(igUserId, token)` → `id, username, name, media_count`;
  `media(igUserId, token, after)` → página com os campos de research.md R3 (`id,caption,media_type,media_product_type,
  media_url,thumbnail_url,permalink,timestamp,alt_text,children{id,media_type,media_url,thumbnail_url,alt_text}`,
  `limit=25`);
  `mediaById(id, token)`; `download(url)` → bytes. Classificar erros (R9): `190`, `10`, `200` → `AccessRevokedException`;
  `4`, `17`, `32`, `613`, 5xx e tempo esgotado → `TransientGraphException`; "não existe" em `mediaById` → `Optional.empty()`.
  Nunca colocar o token em mensagem de exceção ou log.
- [X] T006 [P] Criar `{test}/instagram/InstagramGraphClientTests.java` (sem Spring, com `FakeGraphServer`): leitura da
  conta e dos posts, paginação, carrossel com `children`, reel sem `media_url`, classificação de cada código de erro,
  token só no cabeçalho (nunca na URL).
- [X] T007 [P] Criar `{api}/instagram/SyncActor.java`: `AuthenticatedUser(id = null, name = "Sincronização do
  Instagram", role = "SYSTEM", permissions = [news.create, news.edit.own, news.mark_urgent, tags.manage],
  authorSlug = null, sessionId = null)` (research.md R5).
- [X] T008 Ajustar `{api}/media/MediaService.java` para aceitar ator com `id` nulo em `upload(bytes, user)`
  (`created_by` nulo; auditoria por `recordSystem` quando não há pessoa) e cobrir em
  `{test}/media/MediaUploadTests.java` com um caso "upload pelo sistema". *Feito: o código já aceitava (`created_by`
  nulo; fora de requisição o `AuditLog` grava origem SYSTEM com o nome do ator); só o teste foi acrescentado.*
- [X] T009 Estender `{api}/instagram/InstagramRepository.java`: leitura/gravação de `instagram_connection` (linha única
  `id = 1`), busca de post por `permalink` e por `ig_media_id`, inserção de post vindo da API (`source = 'API'`),
  vínculo de `ig_media_id`/`ig_user_id` num post manual existente, gravação em `instagram_post_media` com
  `ON CONFLICT (post_id, position) DO NOTHING`, `main_media_id`, `needs_photo`.

**Checkpoint**: base pronta — as histórias podem começar.

---

## Fase 3: História 1 — Ligar a conta do Instagram ao painel (P1) 🎯 MVP

**Objetivo**: o Administrador liga, troca e desliga a conta; todos com acesso à fila veem a situação.

**Teste independente**: ligar a conta reserva e ver `@zonasulurgentereserva`, "ligada agora" e "acesso não vence";
desligar e ver "Não conectada".

### Testes da História 1

- [X] T010 [P] [US1] Criar `{test}/instagram/InstagramConnectionApiTests.java` (`@SpringBootTest`,
  `@AutoConfigureMockMvc`, `@Import(TestcontainersConfiguration.class)`, `@DynamicPropertySource` apontando
  `zsu.instagram.graph-base-url` para o `FakeGraphServer`; sessões por `TestSessions.bearer`): `GET /connection` sem
  conta → 404; `PUT` com acesso válido → 200 com `username`, `tokenLast4`, `tokenExpiresAt: null`; acesso recusado pela
  Meta (inclusive conta pessoal ou fora do portfólio, que a Meta não responde — FR-002) → 422 em português; campos
  vazios/ID não numérico → 400; Repórter e Editor → 403 em `PUT`/`DELETE` e 200 em `GET`; `DELETE` → 204 e `GET` → 404; nenhuma resposta, linha de `audit_logs` ou log contém o acesso;
  auditoria `INSTAGRAM_CONNECT`/`INSTAGRAM_DISCONNECT`; troca de conta mantém os posts da fila.

### Implementação da História 1

- [X] T011 [US1] Criar `{api}/instagram/InstagramConnectionService.java`: `connect(igUserId, token, user)` valida na
  Meta (`InstagramGraphClient.account`; a recusa da Meta cobre conta não profissional — research.md R2), cifra com `SecretCipher` (`{api}/auth/application/SecretCipher.java`), grava
  `status = ACTIVE`, `backfill_since = now - InstagramProperties.backfill`, `token_last4`, zera `failures`/`last_error`
  e audita na mesma transação; `disconnect(user)`; `view()` monta o corpo do contrato
  (`contracts/admin-instagram-connection.md`) com `alert` (`REVOKED`, `FAILING` a partir de `failuresBeforeAlert`,
  `EXPIRING` a 10 dias de `token_expires_at`); `token(…)` decifra só para uso interno.
- [X] T012 [US1] Em `{api}/instagram/AdminInstagramController.java`, trocar o `GET /connection` (hoje 404 fixo) e
  acrescentar `PUT /connection` e `DELETE /connection`, com `@PreAuthorize("hasAuthority('instagram.review')")` no `GET`
  e `instagram.settings` nas escritas; corpo de entrada `{ igUserId, accessToken }`.
- [X] T013 [P] [US1] Atualizar `InstagramConnection` em `{fe}/types/admin.ts` para o contrato (remover `publishRule`,
  `tokenExpiresAt`/`tokenDaysLeft` anuláveis, `status`, `igUserId`, `connectedAt`, `connectedBy`, `lastSuccessAt`,
  `tokenLast4`, `alert`) e o `instagramConnectionMock` em `{fe}/mocks/admin.ts` no mesmo formato.
- [X] T014 [US1] Ajustar `getInstagramConnection` em `{fe}/services/admin/instagram-service.ts` (sem cálculo de
  `tokenDaysLeft` quando não vence) e cobrir em `{fe}/services/admin/instagram-service.test.ts`.
- [X] T015 [US1] Acrescentar as Server Actions `connectInstagram({ igUserId, accessToken })` e `disconnectInstagram()`
  em `{fe}/app/admin/(painel)/instagram/actions.ts` (sem API: resultado "simulado", como as atuais).
- [X] T016 [US1] Criar `{fe}/components/admin/instagram-connection.tsx`: painel "Conta do Instagram" para quem tem
  `instagram.settings` — formulário com ID da conta e acesso (campo tipo senha, nunca reexibido), ajuda curta de onde
  achar os dois no painel da Meta, botões Ligar/Trocar e Desligar (com confirmação); mostra
  `@usuário`, ligada por/quando, última sincronização, `…tokenLast4` e "acesso não vence" ou a validade.
- [X] T017 [US1] Em `{fe}/app/admin/(painel)/instagram/page.tsx`, usar o contrato novo no cabeçalho (sem "renova
  sozinho" nem `publishRule`; texto "Cada post vira uma notícia em rascunho"), mostrar o `alert` e incluir o
  `InstagramConnection` para o Administrador.

**Checkpoint**: História 1 funcionando e testada sozinha.

---

## Fase 4: História 2 — Posts novos entram sozinhos na fila, com foto (P1)

**Objetivo**: varredura periódica coloca posts novos na fila com mídia; o job gera o rascunho com foto e crédito.

**Teste independente**: publicar um post na conta reserva e ver o post na fila e o rascunho em Notícias com a foto,
sem tocar no painel.

### Testes da História 2

- [X] T018 [P] [US2] Criar `{test}/instagram/InstagramSyncTests.java` (`@SpringBootTest` + `FakeGraphServer`,
  `zsu.jobs.enabled=false`, chamando `InstagramSyncService.sync()` e `JobWorker.runOnce()` direto, `AI_PROVIDER=fake`):
  primeira varredura traz só os posts dos últimos 7 dias; 30 posts no período (2 páginas de 25) entram todos, sem
  perda nem duplicação; segunda varredura sem novidade não muda nada; post manual com o mesmo link não duplica, ganha
  `ig_media_id` e mídia e **continua sem rascunho** (o job não gera para `source = 'MANUAL'`); foto → `media_url`; carrossel → todas as imagens em ordem,
  principal = primeira; reel → capa (`VIDEO_COVER`); vídeo sem `media_url` nem capa → `needs_photo = true`; o job cria
  notícia `origin = INSTAGRAM`, status rascunho, `created_by` nulo, foto principal = imagem guardada e crédito
  "Foto: Reprodução/Instagram @zonasulurgentereserva"; rodar o job duas vezes não cria segunda notícia nem mídia
  duplicada; `alt_text` do post vira o texto alternativo da foto; falha da IA → `ERROR` e "Reprocessar" funciona; sem
  conta ligada a varredura não chama a Meta; `POST /connection/sync` → 202 para Administrador, 403 para Repórter e
  Editor, 409 sem conta ativa; ligar a conta dispara a primeira varredura.

### Implementação da História 2

- [X] T019 [US2] Criar `{api}/instagram/InstagramSyncService.java` — `sync()`: lê a conexão `ACTIVE`, pagina
  `InstagramGraphClient.media` do mais novo para o mais antigo até passar de `max(backfill_since, último post conhecido)`,
  normaliza o link (`https://www.instagram.com/{p|reel}/{codigo}/`), insere os novos (`source = 'API'`, `status = NEW`) ou
  vincula ao manual existente pelo link (research.md R6, mantendo `source = 'MANUAL'`), enfileira `INSTAGRAM_IMPORT`
  com `{ "postId": … }` (novos e manuais vinculados sem mídia) pela
  `JobQueue` na mesma transação, e grava `last_sync_at`/`last_success_at`/`failures = 0`.
- [X] T020 [US2] Criar `{api}/instagram/InstagramImportJob.java` (`JobHandler`, tipo `INSTAGRAM_IMPORT`, idempotente):
  baixa as mídias que faltam (`InstagramGraphClient.download` → `MediaService.upload` com `SyncActor`), grava
  `instagram_post_media` e `main_media_id`, marca `needs_photo` quando não há imagem (FR-010) e só chama a geração do
  rascunho se `source = 'API'`, `status IN (NEW, ERROR)` e sem notícia (post manual vinculado só ganha a mídia —
  research.md R11).
- [X] T021 [US2] Em `{api}/instagram/InstagramQueueService.java`, separar a geração para aceitar o ator de sistema
  (`SyncActor`) e preencher `NewsDraft.Image(url da foto principal, alt = alt_text do post ou "" (rascunho não exige;
  publicar exige — `{api}/news/admin/DraftValidator.java`), caption = null, credit =
  "Foto: Reprodução/Instagram @" + username)` quando houver foto; auditoria por `recordSystem` quando o ator for o
  sistema; `INSTAGRAM_IMPORT` da varredura com `detail("source", "API")`.
- [X] T022 [US2] Criar `{api}/instagram/InstagramSyncScheduler.java` (`@Scheduled(fixedDelayString =
  "${zsu.instagram.sync-interval:15m}", initialDelayString = "1m")`, desligado se `JobsProperties.enabled()` for
  falso, exceções logadas sem o token, como `{api}/news/admin/ScheduledPublisher.java`) e o
  `POST /connection/sync` (202; 409 sem conta ativa; `instagram.settings`) em
  `{api}/instagram/AdminInstagramController.java`; o `connect` da T011 passa a disparar uma varredura logo depois de
  ligar (na US1 ele só grava).
- [X] T023 [US2] Em `{api}/instagram/InstagramPostView.java` e no mapeamento de `{api}/instagram/InstagramRepository.java`,
  acrescentar `source`, `needsPhoto`, `mediaUrls` e fazer `thumbnailUrl` apontar para a foto principal guardada.
- [X] T024 [P] [US2] Em `{fe}/types/admin.ts`, acrescentar `source`, `needsPhoto`, `mediaUrls` em `InstagramPost`;
  em `{fe}/components/admin/instagram-queue.tsx`, nota de `NEW` diferente para manual ("Clique em Gerar agora") e
  sincronizado ("a IA gera o rascunho automaticamente"), selo "Precisa de foto" quando `needsPhoto`, miniatura pela
  foto guardada; ajustar os mocks de posts em `{fe}/mocks/admin.ts`; acrescentar a Server Action `syncInstagramNow()` em
  `{fe}/app/admin/(painel)/instagram/actions.ts` e o botão "Sincronizar agora" em
  `{fe}/components/admin/instagram-connection.tsx`.

**Checkpoint**: Histórias 1 e 2 funcionando — MVP completo (post vira rascunho com foto sozinho).

---

## Fase 5: História 3 — Avisar quando o post muda ou some no Instagram (P2)

**Objetivo**: legenda alterada e post apagado são marcados na fila, sem mexer na notícia.

**Teste independente**: editar a legenda de um post importado (no servidor falso ou na conta reserva) e ver
"Alterado no Instagram"; apagar e ver "Removido do Instagram".

### Testes da História 3

- [X] T025 [P] [US3] Acrescentar em `{test}/instagram/InstagramSyncTests.java`: legenda alterada → `CHANGED_AT_SOURCE`,
  `current_caption` = nova, `caption` original intacta, notícia sem alteração; "Marcar como revisado" volta para
  `IMPORTED` até a próxima mudança; post importado ausente da lista e `GET /{media-id}` "não existe" →
  `REMOVED_AT_SOURCE`; post fora da janela de 30 dias não é conferido; ausência por paginação incompleta não marca
  como removido (só a confirmação individual marca).

### Implementação da História 3

- [X] T026 [US3] Em `{api}/instagram/InstagramSyncService.java`, acrescentar a reconciliação (research.md R7): dentro de
  `InstagramProperties.reconcileWindow`, comparar a legenda dos posts já importados (`CHANGED_AT_SOURCE` +
  `current_caption` + `source_changed_at`) e confirmar ausentes com `mediaById` antes de `REMOVED_AT_SOURCE`; métodos
  correspondentes em `{api}/instagram/InstagramRepository.java`.

**Checkpoint**: Histórias 1–3 funcionando.

---

## Fase 6: História 4 — Problemas da integração visíveis no painel (P2)

**Objetivo**: acesso revogado e falhas que persistem aparecem no painel; falhas passageiras não fazem alarme.

**Teste independente**: o servidor falso responde `code 190` → aviso no painel e varredura parada; gerar e colar acesso
novo → volta a sincronizar.

### Testes da História 4

- [X] T027 [P] [US4] Acrescentar em `{test}/instagram/InstagramSyncTests.java`: `190` → conexão `REVOKED`, auditoria
  `INSTAGRAM_ACCESS_LOST` (uma vez, sem o token), varreduras seguintes não chamam a Meta, `GET /connection` com
  `alert.kind = REVOKED`; 5xx/limite → `failures` sobe, sem alerta até 3 seguidas, `FAILING` na 3ª, sucesso zera;
  importação manual continua funcionando com a conexão `REVOKED`; ligar de novo limpa o alerta.

### Implementação da História 4

- [X] T028 [US4] Em `{api}/instagram/InstagramSyncService.java` e `{api}/instagram/InstagramConnectionService.java`,
  tratar `AccessRevokedException` (status `REVOKED`, `last_error` em português, auditoria `INSTAGRAM_ACCESS_LOST` por
  `recordSystem`) e `TransientGraphException` (`failures + 1`, `last_error`), parar a varredura com conexão `REVOKED`;
  `InstagramImportJob` com acesso revogado falha sem repetir à toa.
- [X] T029 [P] [US4] Em `{fe}/app/admin/(painel)/instagram/page.tsx` e `{fe}/components/admin/instagram-connection.tsx`,
  mostrar o `alert` (vermelho para `REVOKED`, âmbar para `FAILING`/`EXPIRING`) com a última sincronização boa e, para o
  Administrador, o passo a passo para gerar acesso novo e religar.

**Checkpoint**: todas as histórias funcionando.

---

## Fase 7: Acabamento

- [X] T030 [P] Teste de ponta a ponta no modo demonstração em `{e2e}/admin.spec.ts`: a tela do Instagram mostra a
  conexão do mock (sem "renova sozinho"), o Administrador vê o formulário de ligar e um Repórter não.
- [X] T031 [P] Atualizar `docs/documentacao/usuario/05-instagram-e-ia.md` (ligar a conta, o que entra sozinho e quando,
  foto e crédito automáticos, avisos, "Precisa de foto") e `docs/documentacao/tecnico/10-arquitetura.md` (fluxo
  varredura → job `INSTAGRAM_IMPORT` → IA; configuração `zsu.instagram`); README do backend se a lista de módulos
  mudar.
- [X] T032 Rodar `./mvnw verify` (backend) e `npm run format:check && npm run lint && npm run typecheck && npm test &&
  npm run test:e2e` (frontend); corrigir o que falhar.
- [X] T033 Validar com a conta reserva os 12 cenários de `specs/001-conexao-instagram/quickstart.md` e a conferência de
  que o acesso (`EAA…`) não aparece em logs nem em `audit_logs`; registrar o resultado e marcar a spec como concluída.
- [X] T034 Atualizar `docs/backlog.md` (BE-013 e FE-155 → Concluído) e `docs/changelog.md` pelo `/encerrar-dia`.

---

## Dependências e ordem

- **Fase 1** → **Fase 2** → histórias.
- **US1** (Fase 3) primeiro: a varredura precisa de uma conexão gravada. A US1 não depende da varredura: ligar só
  grava; a varredura após ligar e o "Sincronizar agora" entram na US2 (T022, T024).
- **US2** depende de US1. **US3** e **US4** dependem de US2 (mesma varredura) e são independentes entre si.
- Acabamento depois das histórias desejadas.

### Dentro de cada história

Testes primeiro (devem falhar), depois serviço → controller → frontend.

### Paralelismo

- Fase 1: T002 e T003 juntas (T001 sozinha).
- Fase 2: T006 e T007 em paralelo depois de T004/T005.
- US1: T010 (teste) e T013 (tipos do front) em paralelo; T014–T017 depois de T013.
- US2: T018 e T024 em paralelo com o trabalho do backend.
- US3 e US4 podem ser feitas em paralelo por pessoas diferentes (mexem em partes diferentes da varredura, com cuidado
  no mesmo arquivo `InstagramSyncService.java`).
- Acabamento: T030 e T031 em paralelo.

## Estratégia

1. **MVP = US1 + US2** (ambas P1): ligar a conta e receber posts como rascunho com foto. Validar com os cenários 1–7 do
   quickstart.
2. **Incremento 1**: US3 (avisos de alteração/remoção) — cenários 8–9.
3. **Incremento 2**: US4 (avisos de problema) — cenários 10–11.
4. Cada incremento fecha com CI verde e documentação atualizada.
