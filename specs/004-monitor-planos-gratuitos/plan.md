# Plano de implementação: Monitor de uso dos planos gratuitos

**Pasta**: `specs/004-monitor-planos-gratuitos` | **Data**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Itens do backlog**: OPS-004 (novo), OPS-002, BE-012, BE-013, BE-014 — implementar antes da 002 e da 005

## Resumo

Um módulo `usage` no backend mede, a cada 30 minutos, o uso das fotos (espaço, gravações e leituras do mês, pela API
de métricas da Cloudflare, conferida com a conta do próprio sistema), dos pedidos à IA (contados pelo sistema, por
modelo, no minuto e no dia) e do disco do servidor. Mudanças de nível (70%/90%) e de trava vão para a auditoria e para
um `UsageNotifier` (painel agora; e-mail quando a spec do Resend existir). As travas agem onde o recurso é gasto: o
envio de foto recusa (507), o Instagram entra "aguardando espaço" e a IA adia pela fila sem gastar tentativa. A tela
`/admin/uso` e uma faixa no painel são só do Administrador. Decisões em [research.md](research.md).

## Contexto técnico

**Linguagem/versão**: Java 25 (API), TypeScript strict / Next.js 16.4.6

**Dependências principais**: módulos `media` (`MediaService.upload`), `ai` (`GeminiEditorialAi`), `instagram`
(`InstagramImportJob`, `InstagramQueueService`), `jobs` (`JobWorker`, `JobQueue`), `audit`. Cliente HTTP do Spring
(`RestClient`) para a GraphQL da Cloudflare. Nenhuma biblioteca nova.

**Armazenamento**: `V12__usage_monitor.sql` — `usage_state`, `usage_counters`, colunas em `media_assets` e
`instagram_posts`, `CHECK` da auditoria ([data-model.md](data-model.md))

**Testes**: JUnit + Testcontainers com servidor falso da Cloudflare (como o `FakeGraphServer` do Instagram) e
relógio controlado; Vitest (service e formatação); Playwright no modo demonstração

**Plataforma**: local e VPS (produção)

**Tipo de projeto**: aplicação web (API + BFF Next)

**Metas**: leitura da nuvem ≤ 1 h (FR-003); tela em < 10 s (SC-002); trava antes de qualquer gasto acima do limite

**Restrições**: credencial da Cloudflare só de leitura e só no `.env`; na dúvida, travar (FR-010); nada de espera
dentro de requisição (a fila adia)

**Escala**: ~6 recursos; poucas centenas de gravações/pedidos por dia

## Verificação da constituição

| Princípio | Como o plano cumpre | Situação |
|---|---|---|
| I. Português | Tela, mensagens (507/429), auditoria e manual em português | ✅ |
| II. Documentação | Manual: seção "Uso dos planos" (cap. 6 ou 7) e as mensagens de trava nas Dúvidas; técnico: módulo `usage` no cap. 10, variáveis `CLOUDFLARE_*`/`USAGE_*` no cap. 12 e passo no cap. 13; backlog e changelog | ✅ |
| III. Segurança | Token da Cloudflare só de leitura, no `.env`; `settings.manage` na API e no menu; auditoria na transação | ✅ |
| IV. Site sem API | Tela em demonstração com mocks; o site público não muda | ✅ |
| V. Contratos explícitos | V12 nova; contrato em [contracts/](contracts/admin-usage.md) espelhado em `src/types` | ✅ |
| VI. Leitor primeiro | Leituras de fotos nunca travam (as fotos continuam no ar) | ✅ |
| VII. IA só rascunho | A trava só adia rascunhos; nada é publicado sozinho | ✅ |
| VIII. Verificado | Testes de integração para cada regra (lista no [quickstart](quickstart.md)); CI verde | ✅ |
| IX. Stack combinada | Sem dependência nova; reaproveita fila, auditoria e `RestClient` | ✅ |

Reavaliada após o desenho: sem violações.

## Estrutura do projeto

### Documentação (esta spec)

```text
specs/004-monitor-planos-gratuitos/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/admin-usage.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Código-fonte

```text
System-Zona-Sul-Urgente-Web-Backend/src/main/
├── resources/db/migration/V12__usage_monitor.sql                 # novo
├── resources/application.yml                                     # zsu.usage (recursos, refresh, 70/90)
└── java/br/com/zonasulurgente/api/
    ├── usage/                                                    # novo módulo
    │   ├── UsageProperties.java                                  # recursos configuráveis (FR-013)
    │   ├── QuotaGuard.java · QuotaDeferredException.java         # interface pública p/ os outros módulos
    │   ├── QuotaService.java                                     # uso efetivo, níveis, travas, auditoria
    │   ├── UsageMeter.java · CloudflareR2Meter.java · DiskMeter.java
    │   ├── UsageNotifier.java · PanelOnlyNotifier.java           # e-mail entra com a spec do Resend
    │   ├── UsageRepository.java · UsageRefreshJob.java (@Scheduled)
    │   └── AdminUsageController.java                             # GET /admin/usage, /refresh, /alerts
    ├── jobs/JobQueue.java · jobs/JobWorker.java                  # defer() sem gastar tentativa
    ├── media/MediaService.java                                   # pergunta ao QuotaGuard; stored_bytes
    ├── ai/GeminiEditorialAi.java                                 # conta cada chamada por modelo
    ├── instagram/InstagramImportJob.java · InstagramQueueService.java · InstagramPhotoRetryJob.java (novo)
    └── audit/AuditAction.java                                    # USAGE_LEVEL, USAGE_LOCK, USAGE_UNLOCK

System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api/usage/
├── FakeCloudflareGraphql.java · UsageApiTests.java · QuotaLockTests.java · AiQuotaTests.java

infra/compose.prod.yaml · infra/prod.env.example                  # CLOUDFLARE_*, USAGE_AI_*

System-Zona-Sul-Urgente-Web-Frontend/src/
├── types/admin.ts · mocks/admin.ts
├── services/admin/usage-service.ts (+ teste)
├── config/admin-navigation.ts                                    # "Uso dos planos" (settings.manage)
├── app/admin/(painel)/uso/{page.tsx,actions.ts}                  # novos
├── app/admin/(painel)/layout.tsx                                 # faixa de alerta (Administrador)
└── components/admin/
    ├── usage-overview.tsx                                        # novo: barras, leitura, "Atualizar agora"
    ├── usage-alert-banner.tsx                                    # novo
    ├── instagram-queue.tsx                                       # selos "Aguardando espaço/IA"
    └── editor/news-editor.tsx                                    # mensagem do 507 no envio de foto
```

**Decisão de estrutura**: módulo próprio (`usage`) com interfaces para os demais — mesmo padrão de `ai` e `media`,
e pronto para ser copiado para outros projetos.

## Complexidade

Sem violações a justificar.
