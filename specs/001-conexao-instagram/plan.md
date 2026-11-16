# Plano de implementação: Conexão com a conta do Instagram

**Pasta**: `specs/001-conexao-instagram` | **Data**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Itens do backlog**: BE-013, FE-155

## Resumo

Ligar a conta profissional do Instagram ao painel com o acesso do "login unificado" da Meta (colado pelo
Administrador, cifrado no banco), varrer a conta a cada 15 minutos e colocar os posts novos na fila com a mídia guardada
no armazenamento de fotos; um job por post baixa as imagens e pede o rascunho à IA, que nasce com foto principal e
crédito. A mesma varredura percebe legenda alterada e post apagado (sem mexer na notícia) e avisa no painel quando o
acesso deixa de funcionar. Decisões em [research.md](research.md).

## Contexto técnico

**Linguagem/versão**: Java 25 (API), TypeScript strict / Next.js 16 (painel)

**Dependências principais**: Spring Boot 4 (`RestClient`, `@Scheduled`), módulos existentes `jobs` (fila),
`media` (`MediaService`), `ai` (`EditorialAiProvider`), `audit` (`AuditLog`), `auth` (`SecretCipher`), `news`
(`AdminNewsService.createDraft`). Nenhuma dependência nova.

**Armazenamento**: PostgreSQL 18 — migração `V10__instagram_connection.sql` ([data-model.md](data-model.md)); imagens
pelo `MediaStorage` (pasta local em dev, R2 em produção)

**Testes**: JUnit + Testcontainers (PostgreSQL real) com servidor HTTP local no lugar da Meta; Vitest (tipos e
service do painel); Playwright no modo demonstração (tela de conexão)

**Plataforma**: API e painel locais agora; VPS depois (sem mudança de código)

**Tipo de projeto**: aplicação web (API + BFF Next)

**Metas de desempenho**: varredura de um ciclo < 10 s sem posts novos; post novo vira rascunho em até 20 min (SC-001)

**Restrições**: só chamadas de saída (sem webhook); permissão mínima `instagram_basic`; o acesso nunca sai da API nem
vai para logs/auditoria; limite de chamadas da Meta (1–3 páginas por ciclo)

**Escala**: uma conta; ~5 posts/dia; reconciliação sobre 30 dias (~150 posts)

## Verificação da constituição

| Princípio | Como o plano cumpre | Situação |
|---|---|---|
| I. Português | Mensagens, avisos da tela e auditoria em português; identificadores em inglês | ✅ |
| II. Documentação | Atualiza `usuario/05-instagram-e-ia.md`, `tecnico/10-arquitetura.md` (módulo instagram), changelog e backlog (BE-013) | ✅ |
| III. Segurança | Acesso cifrado (AES-256-GCM, `SecretCipher`), nunca devolvido nem logado; ligar/trocar só `instagram.settings` via `@PreAuthorize`; auditoria na transação de ligar/desligar; permissão mínima na Meta | ✅ |
| IV. Site sem API | Modo demonstração: mock de `InstagramConnection` no novo formato; ações respondem "simulado" | ✅ |
| V. Contratos explícitos | Migração Flyway nova (V10); contrato em [contracts/](contracts/admin-instagram-connection.md) espelhado em `src/types/admin.ts`; o módulo `instagram` usa `media`, `ai`, `news` e `auth` por seus serviços públicos | ✅ (ver Complexidade) |
| VI. Leitor primeiro | Não muda o site público; rascunhos só aparecem no site depois de publicados | ✅ |
| VII. IA só rascunho | Sempre rascunho; 1 post → no máximo 1 notícia; só conteúdo público; `publishRule`/`URGENT_AUTO` removido | ✅ |
| VIII. Verificado | Testes de integração para cada requisito (lista no [quickstart](quickstart.md)); CI verde | ✅ |
| IX. Stack combinada | Sem dependência nova; fila de jobs no PostgreSQL; `RestClient` do Spring | ✅ |

Reavaliada depois do desenho (fase 1): sem violações.

## Estrutura do projeto

### Documentação (esta spec)

```text
specs/001-conexao-instagram/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # decisões R1–R11
├── data-model.md        # V10, tabelas, transições, jobs, configuração
├── quickstart.md        # roteiro de validação
├── contracts/admin-instagram-connection.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Código-fonte

```text
System-Zona-Sul-Urgente-Web-Backend/src/main/
├── resources/
│   ├── db/migration/V10__instagram_connection.sql          # novo
│   └── application.yml                                      # bloco zsu.instagram
└── java/br/com/zonasulurgente/api/
    ├── instagram/
    │   ├── AdminInstagramController.java      # GET/PUT/DELETE /connection, POST /connection/sync
    │   ├── InstagramQueueService.java         # generate() aceita o ator de sistema; nota manual × API
    │   ├── InstagramRepository.java           # colunas novas, upsert por permalink, mídias
    │   ├── InstagramPostView.java             # source, needsPhoto, mediaUrls
    │   ├── InstagramProperties.java           # novo (zsu.instagram)
    │   ├── InstagramGraphClient.java          # novo: chamadas à Graph API (RestClient, Bearer)
    │   ├── InstagramConnectionService.java    # novo: ligar/trocar/desligar, situação, alertas
    │   ├── InstagramSyncService.java          # novo: varredura, backfill, reconciliação
    │   ├── InstagramSyncScheduler.java        # novo: @Scheduled a cada sync-interval
    │   ├── InstagramImportJob.java            # novo: JobHandler INSTAGRAM_IMPORT (mídia + IA)
    │   └── SyncActor.java                     # novo: ator de sistema (permissões de Repórter)
    ├── media/MediaService.java                # upload aceita ator sem id (created_by nulo)
    └── audit/AuditAction.java                 # INSTAGRAM_CONNECT, INSTAGRAM_DISCONNECT, INSTAGRAM_ACCESS_LOST

System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api/instagram/
├── InstagramConnectionApiTests.java           # ligar, validar, permissões, sem vazar o acesso
├── InstagramSyncTests.java                    # varredura, mídia, dedup, reconciliação, falhas
└── FakeGraphServer.java                       # servidor HTTP local que imita a Meta

System-Zona-Sul-Urgente-Web-Frontend/src/
├── types/admin.ts                             # InstagramConnection novo (sem publishRule)
├── mocks/admin.ts                             # mock no novo formato
├── services/admin/instagram-service.ts        # getInstagramConnection (+ teste)
├── app/admin/(painel)/instagram/
│   ├── actions.ts                             # connectInstagram, disconnectInstagram, syncInstagramNow
│   └── page.tsx                               # cabeçalho com situação, alerta e "Ligar conta"
└── components/admin/
    ├── instagram-connection.tsx               # novo: painel de conexão (Administrador)
    └── instagram-queue.tsx                    # nota manual × automático; "precisa de foto"

docs/documentacao/usuario/05-instagram-e-ia.md # como ligar a conta, o que entra sozinho, avisos
docs/documentacao/tecnico/10-arquitetura.md    # fluxo da sincronização
```

**Decisão de estrutura**: tudo do Instagram fica no módulo `instagram` (API) e na tela existente do painel; os
outros módulos são usados só pelos serviços públicos que já expõem.

## Complexidade

| Ponto | Por que é necessário | Alternativa mais simples recusada |
|---|---|---|
| `instagram` usa `SecretCipher` do módulo `auth` | Requisito "cifrado como o 2FA"; mesma chave e rotina já testadas | Cópia da classe de cifra no módulo (duplicação de código de segurança) |
| Ator de sistema com `id` nulo | Rascunho gerado sem pessoa logada | Usuário "robô" no banco (mais uma conta a proteger) |
