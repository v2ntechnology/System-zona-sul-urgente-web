---
description: "Tarefas da spec 004 — monitor de uso dos planos gratuitos"
---

# Tarefas: Monitor de uso dos planos gratuitos

**Entrada**: `specs/004-monitor-planos-gratuitos/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Testes**: incluídos — constituição VIII (integração com PostgreSQL real; Cloudflare e Gemini falsos).

**Organização**: US1 ver o uso (P1) · US2 avisos (P1) · US3 travas (P1) · US4 limites configuráveis (P3, já coberta
pela base: só validação).

## Formato: `[ID] [P?] [História] Descrição`

## Caminhos (abreviações)

- `{api}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/java/br/com/zonasulurgente/api`
- `{res}` = `System-Zona-Sul-Urgente-Web-Backend/src/main/resources`
- `{test}` = `System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api`
- `{fe}` = `System-Zona-Sul-Urgente-Web-Frontend/src`
- `{e2e}` = `System-Zona-Sul-Urgente-Web-Frontend/e2e`

---

## Fase 1: Preparação

- [X] T001 Criar `{res}/db/migration/V12__usage_monitor.sql` conforme data-model.md: `usage_state` (`resource
  varchar(80) PK`, `cloud_value bigint`, `cloud_read_at timestamptz`, `cloud_error varchar(300)`, `level varchar(10)
  NOT NULL DEFAULT 'NORMAL' CHECK (level IN ('NORMAL','WARN','CRITICAL'))`, `locked boolean NOT NULL DEFAULT false`,
  `changed_at timestamptz NOT NULL DEFAULT now()`); `usage_counters` (`resource varchar(80)`, `window_start
  timestamptz`, `count bigint NOT NULL`, PK `(resource, window_start)`); `media_assets.stored_bytes bigint` e
  `stored_objects integer`; `instagram_posts.waiting varchar(10) CHECK (waiting IN ('SPACE','AI'))` e
  `waiting_until timestamptz`; recriar `audit_logs_action_check` com os valores da V11 mais `USAGE_LEVEL`,
  `USAGE_LOCK`, `USAGE_UNLOCK`.
- [X] T002 [P] Acrescentar `USAGE_LEVEL`, `USAGE_LOCK`, `USAGE_UNLOCK` em `{api}/audit/AuditAction.java`.
- [X] T003 [P] Criar `{api}/usage/UsageProperties.java` (`zsu.usage`: `refresh` 30m, `warn-at` 70, `critical-at` 90,
  mapa `resources` com `label`, `unit` BYTES|OPERATIONS|REQUESTS, `limit`, `period` NONE|MINUTE|DAY_PACIFIC|MONTH,
  `lock-at` opcional, `meter` cloudflare-r2-storage|cloudflare-r2-class-a|cloudflare-r2-class-b|disk|counter, lista
  de `actionType` das classes A e B) e o bloco em `{res}/application.yml` com os recursos de research.md R8 (IA por
  modelo com `USAGE_AI_MAIN_RPM/RPD` e `USAGE_AI_FALLBACK_RPM/RPD`). **Recurso de IA sem limite** não some: aparece
  como "Sem limite configurado" (nível crítico) e a API avisa no log ao subir — senão a IA ficaria sem trava em
  silêncio; outros recursos sem configuração não aparecem. `CLOUDFLARE_*`
  e `USAGE_AI_*` em `infra/compose.prod.yaml` e `infra/prod.env.example`.

---

## Fase 2: Base (bloqueia todas as histórias)

- [X] T004 Em `{api}/jobs/JobQueue.java` criar `defer(Job job, Instant runAt, String reason)` (volta a `PENDING`,
  `run_at = :runAt`, **sem** incrementar `attempts`, `last_error = 'Aguardando: ' || reason`); criar
  `{api}/jobs/JobDeferredException.java` (`Instant retryAt`, `reason`) e em `{api}/jobs/JobWorker.java` tratar essa
  exceção chamando `defer` — sem log de erro. A fila não conhece cota: `QuotaDeferredException` (módulo `usage`)
  **estende** `JobDeferredException` (dependência `usage` → `jobs`, nunca o contrário). Cobrir em
  `{test}/jobs/JobQueueTests.java`.
- [X] T005 Criar o núcleo de `{api}/usage/`: `QuotaGuard` (interface pública: `check(String resource, long amount)` →
  lança `QuotaDeferredException`/`QuotaBlockedException` ou deixa passar; `record(String resource, long amount)`),
  `QuotaDeferredException(Instant retryAt, String reason) extends JobDeferredException`, `QuotaBlockedException` (`ApiException` 507 "Espaço de
  fotos esgotado" com `detail`), `UsageRepository` (estado, contadores com `INSERT … ON CONFLICT DO UPDATE`,
  janelas pelo relógio do banco, limpeza de janelas antigas) e `QuotaService` (uso efetivo = `max(nuvem + depois,
  sistema)`, nível, travado; data-model.md "Uso efetivo"); `UsageNotifier` + `PanelOnlyNotifier`.
- [X] T006 [P] Criar `{test}/usage/FakeCloudflareGraphql.java` (servidor falso da GraphQL com respostas de
  `r2StorageAdaptiveGroups`/`r2OperationsAdaptiveGroups`, falha e atraso controláveis) e relógio controlável nos
  testes do módulo.

**Checkpoint**: base pronta.

---

## Fase 3: História 1 — Ver quanto já foi usado (P1) 🎯 MVP

**Objetivo**: tela do Administrador com uso/limite/% de cada recurso e hora da leitura.

**Teste independente**: com fotos gravadas e rascunhos gerados, a tela mostra números iguais aos da nuvem falsa e à
contagem da IA.

### Testes da História 1

- [X] T007 [P] [US1] Criar `{test}/usage/UsageApiTests.java`: `GET /admin/usage` devolve os recursos configurados com
  `used`, `limit`, `percent`, `source`, `readAt`, `resetsAt`; recurso sem configuração não aparece; leitura da nuvem
  falhando → último valor + `stale: true` + `cloud_error` (nunca número inventado); diferença > 10% entre nuvem e
  sistema → `note`; `POST /admin/usage/refresh` lê na hora e o segundo em menos de 1 min → 429 com
  `retryAfterSeconds`; Editor, Repórter, Comercial → 403; disco com total e livre do sistema de arquivos; recurso de
  IA sem limite configurado aparece como "Sem limite configurado" com nível CRITICAL (G1); nuvem **maior** que a conta
  do sistema (outros usos na mesma conta da Cloudflare) vira só informação, não alerta de diferença (U2).

### Implementação da História 1

- [X] T008 [US1] Criar `{api}/usage/UsageMeter.java` (interface: `read()` → valor por recurso) e
  `{api}/usage/CloudflareR2Meter.java` (`RestClient` para `https://api.cloudflare.com/client/v4/graphql` com
  `Authorization: Bearer` do `CLOUDFLARE_ANALYTICS_TOKEN`, conta `CLOUDFLARE_ACCOUNT_ID`; espaço = máximo de
  `payloadSize + metadataSize` de todos os buckets; Classe A/B = soma de `requests` por `actionType` desde o início do
  mês UTC; o token nunca vai para log nem resposta) e `{api}/usage/DiskMeter.java` (`Files.getFileStore("/")`).
- [X] T009 [US1] Em `{api}/media/MediaService.java` gravar `stored_bytes` (soma dos arquivos enviados ao storage) e
  `stored_objects`; em `{api}/ai/GeminiEditorialAi.java` registrar cada chamada HTTP no `QuotaGuard` por modelo
  (`ia.<modelo>.minuto` e `ia.<modelo>.dia`), inclusive novas tentativas e o modelo reserva.
- [X] T010 [US1] Criar `{api}/usage/UsageRefreshJob.java` (`@Scheduled(fixedDelayString = zsu.usage.refresh)`,
  desligado com `zsu.jobs.enabled=false` nos testes, chamado direto neles) e `{api}/usage/AdminUsageController.java`
  (`GET /api/v1/admin/usage`, `POST /refresh` com limite de 1/min, `GET /alerts`; `@PreAuthorize("hasAuthority(
  'settings.manage')")`), conforme contracts/admin-usage.md.
- [X] T011 [P] [US1] Em `{fe}/types/admin.ts`: `UsageResource`, `UsageReport`, `UsageAlert`; criar
  `{fe}/services/admin/usage-service.ts` (`getUsage`, `getUsageAlerts`, mocks em `{fe}/mocks/admin.ts` no modo
  demonstração) + `{fe}/services/admin/usage-service.test.ts`; formatação de bytes/operações/horário em
  `{fe}/lib/format.ts` (+ teste).
- [X] T012 [US1] Criar `{fe}/app/admin/(painel)/uso/page.tsx` (só `settings.manage`; senão `notFound()`),
  `{fe}/app/admin/(painel)/uso/actions.ts` (`refreshUsage`) e `{fe}/components/admin/usage-overview.tsx` (cartão por
  recurso: barra usado/limite com a cor do nível, %, origem "Cloudflare"/"conta do sistema", "lido às HH:MM",
  "zera em …", selo "Desatualizado", selo "Travado", botão "Atualizar agora"); item **Uso dos planos** em
  `{fe}/config/admin-navigation.ts` (ícone, rota `/admin/uso`, trilha).

**Checkpoint**: H1 funcionando.

---

## Fase 4: História 2 — Ser avisado antes do limite (P1)

**Objetivo**: faixa no painel e auditoria em 70% e 90%, uma vez por mudança de nível.

**Teste independente**: simular 71% e 91% e ver os avisos uma vez cada; voltar abaixo de 70% apaga.

### Testes da História 2

- [X] T013 [P] [US2] Acrescentar em `{test}/usage/UsageApiTests.java`: nível muda NORMAL→WARN→CRITICAL e volta,
  cada mudança gera **uma** auditoria `USAGE_LEVEL` (com `used`, `limit`, `percent`, `from`, `to`, `source`) e uma
  chamada ao `UsageNotifier`; leituras repetidas no mesmo nível não repetem; virada do mês zera os recursos mensais
  e apaga o aviso; `GET /admin/usage/alerts` só traz WARN/CRITICAL/travados.

### Implementação da História 2

- [X] T014 [US2] Em `{api}/usage/QuotaService.java`: comparar o nível novo com `usage_state.level` na leitura e em
  cada `record`, gravar a mudança, auditar (`audit.recordSystem` fora de requisição) e chamar `UsageNotifier` na mesma
  transação. O e-mail aos Administradores (resposta 2B) entra como `EmailUsageNotifier` na spec do Resend, sem mudar
  este módulo; até lá, `PanelOnlyNotifier`.
- [X] T015 [US2] Criar `{fe}/components/admin/usage-alert-banner.tsx` (faixa amarela ≥ 70%, vermelha ≥ 90% ou
  travado, texto "Fotos — espaço em 91%: avalie apagar fotos antigas ou mudar de plano", link para `/admin/uso`) e
  usá-la em `{fe}/app/admin/(painel)/layout.tsx` só para quem tem `settings.manage` (falha ao buscar = sem faixa,
  nunca quebra o painel).

**Checkpoint**: H1 + H2.

---

## Fase 5: História 3 — Nunca passar do limite (P1)

**Objetivo**: recusar foto acima da trava, Instagram sem foto aguardando espaço, IA adiada sem erro, e destravar
sozinho.

**Teste independente**: com o espaço no limite, o envio de foto é recusado, a notícia salva sem foto, o post do
Instagram entra "Aguardando espaço" e, liberando, a foto chega; com a IA no limite do dia, o rascunho espera.

### Testes da História 3

- [X] T016 [P] [US3] Criar `{test}/usage/QuotaLockTests.java`: `POST /admin/media` com `fotos.espaco` ≥ 95% (ou
  `fotos.gravacoes`) → 507 "Espaço de fotos esgotado" e nada gravado no storage nem em `media_assets`; abaixo da
  trava → aceita; leitura da nuvem atrasada + rajada de envios: a conta do sistema trava antes (FR-010); trava liga e
  desliga com auditoria `USAGE_LOCK`/`USAGE_UNLOCK`; `fotos.leituras` e `disco` nunca travam (FR-011).
- [X] T017 [P] [US3] Criar `{test}/usage/AiQuotaTests.java` (com o `FakeGraphServer` do Instagram e IA de teste que
  conta chamadas): no limite do dia, `INSTAGRAM_IMPORT` não chama a IA, o job é adiado para a meia-noite do Pacífico
  sem gastar tentativa e o post fica `waiting = 'AI'` com `waiting_until`, nunca `ERROR`; no limite do minuto, adia
  ~60 s; "Gerar agora" → 429 com `retryAt` e geração enfileirada; ao virar o dia, o rascunho sai sozinho; o modelo
  reserva tem cota própria.
- [X] T018 [P] [US3] Acrescentar em `{test}/usage/QuotaLockTests.java`: com a trava das fotos, a sincronização grava o
  post **sem foto**, `waiting = 'SPACE'`, gera o rascunho e enfileira `INSTAGRAM_PHOTO_RETRY` adiado; ao destravar,
  o job busca a mídia de novo por `GET /{media-id}` e põe a foto principal se o rascunho ainda não tiver uma; post
  apagado na origem → desiste sem erro. **Regressão (C1):** a recusa da trava não pode cair no
  `catch (GraphRejectedException | ApiException e)` genérico de `InstagramImportJob.java:132` (que trata como "imagem
  indisponível" e perde a foto para sempre) — o teste confere `waiting = 'SPACE'` e o job de nova tentativa.

### Implementação da História 3

- [X] T019 [US3] Em `{api}/media/MediaService.java`: antes de processar, `QuotaGuard.check("fotos.espaco", 3 ×
  bytes)` e `check("fotos.gravacoes", nº de arquivos esperado)`; depois de gravar, `record` dos valores reais.
- [X] T020 [US3] Em `{api}/ai/GeminiEditorialAi.java`: `check` de `ia.<modelo>.minuto` e `.dia` antes de cada chamada;
  esgotado o principal, tenta o reserva; os dois esgotados → `QuotaDeferredException` com o próximo horário livre.
- [X] T021 [US3] Em `{api}/instagram/InstagramImportJob.java` e `{api}/instagram/InstagramQueueService.java`: capturar
  `QuotaBlockedException` **antes** do `catch (GraphRejectedException | ApiException e)` genérico (linha 132) e tratá-la
  na foto (post sem foto, `waiting = 'SPACE'`, segue para o rascunho, enfileira
  `INSTAGRAM_PHOTO_RETRY` com `run_at` = próxima leitura) e `QuotaDeferredException` na IA (`waiting = 'AI'`,
  `waiting_until`, relança para a fila adiar); "Gerar agora" com a IA travada → 429 `"Limite da IA"` com `retryAt`
  e enfileira; limpar `waiting` quando o rascunho ou a foto saem. Criar `{api}/instagram/InstagramPhotoRetryJob.java`.
- [X] T022 [US3] Em `{api}/instagram/InstagramRepository.java`/`InstagramPostView`: `waiting` e `waitingUntil` na
  listagem; em `{fe}/types/admin.ts` e `{fe}/components/admin/instagram-queue.tsx`: selos "Aguardando espaço" e
  "Aguardando a IA · volta às HH:MM"; em `{fe}/components/admin/editor/news-editor.tsx` (envio de foto): mostrar o
  `detail` do 507 e deixar salvar sem foto; mensagem do 429 no "Gerar agora".

**Checkpoint**: H1 + H2 + H3 = funcionalidade completa.

---

## Fase 6: História 4 — Ajustar os limites sem programar (P3)

- [X] T023 [US4] Teste em `{test}/usage/UsageApiTests.java`: limite e `lock-at` vindos da configuração (propriedades
  de teste) são os usados na tela, nos avisos e nas travas; recurso removido da configuração some da tela e não trava.

---

## Fase 7: Acabamento

- [X] T024 [P] Teste de ponta a ponta no modo demonstração em `{e2e}/admin.spec.ts`: tela **Uso dos planos** com as
  barras de exemplo e a faixa de alerta; Editor não vê o item.
- [X] T025 [P] Documentação: manual (`docs/documentacao/usuario/06-editorias-e-equipe.md` ou `07-…`: seção "Uso dos
  planos gratuitos" — o que cada barra significa, o que fazer no amarelo/vermelho, o que a trava faz; `08-duvidas.md`:
  "A foto não sobe: espaço de fotos esgotado" e "Rascunho aguardando a IA"); técnico (`10-arquitetura.md`: módulo
  `usage`; `12-variaveis-e-producao.md`: `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `USAGE_AI_*`;
  `13-deploy-vps.md`: criar o token só de leitura "Account Analytics: Read").
- [X] T026 Rodar `./mvnw verify` e `npm run format:check && npm run lint && npm run typecheck && npm test && npm run
  test:e2e`; corrigir o que falhar.
- [ ] T027 Validar em produção os cenários de `specs/004-monitor-planos-gratuitos/quickstart.md` (1–3 com os números
  reais; 4–8 no ambiente local com limites baixos) e registrar no quickstart, com o **ritmo real de uso** (GB e pedidos
  por dia) e a folga estimada até a trava (SC-005).
- [ ] T028 Backlog (OPS-004 → Concluído) e changelog pelo `/encerrar-dia`.

---

## Dependências e ordem

- Fase 1 → Fase 2 → US1 → US2 → US3 → US4 → Acabamento.
- US2 e US3 dependem do `QuotaService` (Fase 2) e da leitura (US1); US3 depende do `JobQueue.defer` (T004).

### Paralelismo

- Fase 1: T002 e T003 juntas.
- Fase 2: T006 em paralelo com T004/T005.
- US1: T007 e T011 em paralelo; T008–T010 em sequência; T012 depois da T011.
- US3: T016, T017 e T018 (testes) em paralelo; T019–T022 em sequência.
- Acabamento: T024 e T025 em paralelo.

## Estratégia

1. **MVP = US1**: ver o uso real das fotos, da IA e do disco (já ajuda a decidir).
2. **US2 + US3** no mesmo ciclo: avisos e travas — a garantia de nunca pagar.
3. **US4**: só validação (a configuração já nasce na Fase 1).
