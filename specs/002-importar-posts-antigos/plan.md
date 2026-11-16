# Plano de implementação: Importar posts antigos do Instagram

**Pasta**: `specs/002-importar-posts-antigos` | **Data**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Itens do backlog**: BE-013, FE-155 (complementa a spec 001)

## Resumo

O Administrador escolhe um período (e, se quiser, desmarca posts numa lista) e a API importa o histórico da conta
ligada em segundo plano, uma página da Meta por job, com andamento e interrupção. Os posts entram na fila com foto,
marcados como antigos, sem gerar rascunho. Na fila, quem revisa marca vários posts e gera rascunhos em lote, com
ritmo controlado pela própria fila de jobs (4/min) e espera automática quando a IA bate o limite. A varredura de 15
minutos passa a conferir, em rodízio, os posts antigos que viraram notícia. Decisões em [research.md](research.md).

## Contexto técnico

**Linguagem/versão**: Java 25 (API), TypeScript strict / Next.js 16.4.6 (painel)

**Dependências principais**: módulos da spec 001 (`InstagramGraphClient`, `InstagramImportJob`,
`InstagramSyncService`, `InstagramQueueService`), `jobs` (`JobQueue` ganha `enqueue` com `runAt`/`maxAttempts`),
`ai` (`AiUnavailableException` × `AiOutputException`), `media`, `audit`. Nenhuma dependência nova.

**Armazenamento**: PostgreSQL 18 — migração `V12__instagram_history.sql` ([data-model.md](data-model.md))

**Testes**: JUnit + Testcontainers com a `FakeGraphServer` ampliada (histórico longo, cursores, limite); Vitest; Playwright
no modo demonstração (tela de importação e seleção em lote)

**Plataforma**: local agora; VPS depois

**Tipo de projeto**: aplicação web (API + BFF Next)

**Metas de desempenho**: 434 posts na fila em < 30 min (SC-001); interromper em < 1 min (SC-004); andamento com no
máximo 1 min de atraso (SC-003)

**Restrições**: chamadas à Meta no mínimo (endereços de mídia reaproveitados da lista, R4); ritmo da IA ≤ 4/min no lote;
a varredura de posts novos não pode ser atrasada pelo histórico nem pela conferência dos antigos

**Escala**: histórico de centenas a poucos milhares de posts; lotes de até 200

## Verificação da constituição

| Princípio | Como o plano cumpre | Situação |
|---|---|---|
| I. Português | Situações, motivos de falha, avisos e auditoria em português | ✅ |
| II. Documentação | Atualiza `usuario/05-instagram-e-ia.md` (importar histórico, lote), `tecnico/10-arquitetura.md`, backlog e changelog | ✅ |
| III. Segurança | Importar/interromper só `instagram.settings`; lote só `instagram.review`; auditoria `INSTAGRAM_HISTORY` e `AI_BATCH`; acesso segue cifrado e fora de logs | ✅ |
| IV. Site sem API | Modo demonstração com mocks de importação, pré-visualização e lote (respostas "simuladas") | ✅ |
| V. Contratos explícitos | V12 nova; contrato em [contracts/](contracts/admin-instagram-history.md) espelhado em `src/types/admin.ts`; `JobQueue` estendido pela própria API pública dele | ✅ |
| VI. Leitor primeiro | Nada muda no site; rascunhos só aparecem depois de publicados | ✅ |
| VII. IA só rascunho | Histórico não gera nada sozinho; lote só cria rascunho, 1 por post | ✅ |
| VIII. Verificado | Testes de integração por requisito (lista no [quickstart](quickstart.md)); CI verde | ✅ |
| IX. Stack combinada | Sem dependência nova; tudo na fila de jobs do PostgreSQL | ✅ |

Reavaliada após o desenho: sem violações.

## Estrutura do projeto

### Documentação (esta spec)

```text
specs/002-importar-posts-antigos/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/admin-instagram-history.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Código-fonte

```text
System-Zona-Sul-Urgente-Web-Backend/src/main/
├── resources/db/migration/V12__instagram_history.sql            # novo
└── java/br/com/zonasulurgente/api/
    ├── jobs/JobQueue.java                       # enqueue(type, payload, runAt, maxAttempts)
    ├── audit/AuditAction.java                   # INSTAGRAM_HISTORY, AI_BATCH
    └── instagram/
        ├── InstagramProperties.java             # batchPerMinute, oldNewsChecksPerSync, historyMaxExcluded
        ├── InstagramHistoryService.java         # novo: preview, start, cancel, view
        ├── InstagramHistoryPageJob.java         # novo: JobHandler INSTAGRAM_HISTORY_PAGE
        ├── InstagramGenerateJob.java            # novo: JobHandler INSTAGRAM_GENERATE (lote)
        ├── InstagramBatchService.java           # novo: criar lote, andamento
        ├── BatchActor.java                      # novo: ator "Lote de <nome>"
        ├── InstagramImportJob.java              # sources/altText no payload; não gera se history_import_id
        ├── InstagramSyncService.java            # payload com sources; rodízio dos antigos com notícia
        ├── InstagramQueueService.java           # geração que repassa AiUnavailableException ao job do lote
        ├── InstagramRepository.java             # tabelas novas, filtro history, rodízio
        ├── InstagramPostView.java               # campo history
        └── AdminInstagramController.java        # /history, /history/preview, /history/cancel, /posts/generate-batch, /batches/{id}

System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api/instagram/
├── FakeGraphServer.java                         # histórico longo, cursores reais, contagem por endpoint
├── InstagramHistoryTests.java                   # novo
└── InstagramBatchTests.java                     # novo

System-Zona-Sul-Urgente-Web-Frontend/src/
├── types/admin.ts · mocks/admin.ts · services/admin/instagram-service.ts (+ teste)
├── app/admin/(painel)/instagram/{actions.ts,page.tsx}
└── components/admin/
    ├── instagram-history.tsx                    # novo: período, lista para desmarcar, andamento, interromper
    └── instagram-queue.tsx                      # selo "Antigo", filtro, seleção e "Gerar rascunhos"
```

**Decisão de estrutura**: tudo no módulo `instagram` e na tela existente; o único toque fora é a sobrecarga do
`JobQueue` (API pública do módulo `jobs`).

## Complexidade

| Ponto | Por que é necessário | Alternativa mais simples recusada |
|---|---|---|
| `JobQueue.enqueue` com `runAt`/`maxAttempts` | Ritmo do lote e espera longa pelo limite da IA dentro da fila existente | Job que dorme entre gerações (prende o worker) |
| Ator `BatchActor` sem `id` | Job sem pessoa logada; permissões reais exigiriam ler `auth` | Interface nova em `auth` só para carregar usuário |
