# Pesquisa e decisões: Monitor de uso dos planos gratuitos

## R1. Onde fica o monitor

- **Decisão**: módulo novo `usage` no backend. Os outros módulos não sabem de cota: falam com duas interfaces públicas
  do módulo — `QuotaGuard` (perguntar se pode gastar e registrar o gasto) e `UsageNotifier` (avisar quando o nível
  muda). Recursos são registros de configuração, não código (FR-013): `usage` não conhece "R2" nem "Gemini", só
  medidores (`UsageMeter`) que cada integração registra.
- **Por quê**: regra da arquitetura (módulos não acessam o repositório de outro) e reaproveitamento em outros
  projetos (portfólio): copiar o módulo + configurar os recursos.
- **Alternativa descartada**: verificar cota dentro de `MediaService`/`GeminiEditorialAi` direto — espalharia a regra.

## R2. Números do R2 (FR-003)

- **Decisão**: API GraphQL de métricas da Cloudflare (`https://api.cloudflare.com/client/v4/graphql`), conjuntos
  `r2StorageAdaptiveGroups` (máximo de `payloadSize + metadataSize` e `objectCount` no período) e
  `r2OperationsAdaptiveGroups` (soma de `requests` agrupada por `actionType`), filtrados pela **conta inteira** (o
  plano grátis é por conta, não por bucket). Gravações = ações de Classe A (`PutObject`, `CopyObject`,
  `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `ListObjects`, `ListBuckets`, …); leituras =
  Classe B (`GetObject`, `HeadObject`, `HeadBucket`, …) — lista na configuração, para acompanhar mudanças de preço.
- **Credencial**: token de API **só de leitura** ("Account Analytics: Read"), em `CLOUDFLARE_ANALYTICS_TOKEN` +
  `CLOUDFLARE_ACCOUNT_ID` no `.env` (constituição III: segredo de configuração só no `.env`). Sem eles, os recursos do
  R2 aparecem como "sem leitura da nuvem" e a trava usa só a conta do próprio sistema (R4).
- **Frequência**: a cada 30 min (`zsu.usage.refresh`) e no botão "Atualizar agora" da tela (no máximo 1 por minuto).
- **Atraso dos dados**: as métricas chegam com atraso de minutos a horas. A trava usa
  `max(último número da nuvem, conta do sistema)` + o que o sistema gravou **depois** da última leitura (R4).
- **Armazenamento**: o plano cobra a média do mês (GB-mês); comparamos o **tamanho atual** com 10 GB, mais
  conservador.

## R3. Pedidos à IA (FR-004, FR-008)

- **Decisão**: contador próprio no banco, por modelo, antes de cada chamada HTTP ao Gemini (inclusive novas
  tentativas e o modelo reserva — cada modelo tem a sua cota). Janelas: **minuto** (deslizante, 60 s) e **dia**
  (zera à meia-noite do horário do Pacífico, como a cota do Gemini). Limites por modelo na configuração.
- **No limite do minuto**: `QuotaGuard` responde "espere N segundos"; a geração lança `QuotaDeferredException`
  com o horário de volta. **No limite do dia**: o mesmo, com o horário de reinício da cota.
- **Por quê**: a cota do plano grátis não tem API de consulta; contar aqui é o único jeito de saber antes de estourar.

## R4. Fotos: conta do próprio sistema e trava (FR-006, FR-010)

- **Decisão**: `media_assets.stored_bytes` (soma real de todos os arquivos gravados da foto: original + versões
  WebP/AVIF + og) e `stored_objects`. Antes de gravar, `MediaService.upload` pede ao `QuotaGuard`
  `fotos.espaco` (+ bytes estimados = 3 × tamanho do original) e `fotos.gravacoes` (+ nº de arquivos); se passar da
  trava, recusa com **507 "Espaço de fotos esgotado"** (problem+json, mensagem para a pessoa) e nada é gravado.
- **Uso estimado entre leituras** = última leitura da nuvem + `stored_bytes` das fotos criadas depois dela.
- **Foto apagada**: hoje o painel não apaga arquivos do R2; quando apagar, o espaço só libera na próxima leitura da
  nuvem (caso-limite da spec).

## R5. Espera em vez de erro (FR-007, FR-008, FR-009)

- **Decisão**: exceção `QuotaDeferredException(Instant retryAt, String motivo)`. O `JobWorker` trata essa exceção à
  parte: reagenda o job para `retryAt` **sem contar tentativa** e sem marcar erro (`JobQueue.defer`).
- **Instagram com fotos travadas**: o `INSTAGRAM_IMPORT` grava o post **sem foto** (`waiting = 'SPACE'`, selo
  "Aguardando espaço"), gera o rascunho normalmente e enfileira `INSTAGRAM_PHOTO_RETRY` adiado; quando a trava
  desliga, ele busca a mídia de novo (`GET /{media-id}`, porque o endereço da Meta expira) e põe a foto principal se o
  rascunho ainda não tiver uma.
- **Instagram com IA travada**: o rascunho fica `waiting = 'AI'` ("Aguardando a IA", com a hora prevista) e o job é
  adiado. "Gerar agora" com a IA travada responde **429** com `retryAt` e enfileira a geração adiada.
- **Por quê**: a fila já existe, é transacional e sobrevive a reinício; nada de `sleep` em requisição.

## R6. Disco do servidor (FR-011)

- **Decisão**: `Files.getFileStore(Path.of("/"))` dentro do contêiner da API mostra o disco do servidor (o Docker
  grava no mesmo disco). Só aviso, nunca trava.

## R7. Avisos (FR-005, FR-012, 2B)

- **Decisão**: tabela `usage_state` (um por recurso: último uso, origem, nível emitido, trava ligada, desde quando).
  Mudou de nível → auditoria `USAGE_LEVEL` (e `USAGE_LOCK`/`USAGE_UNLOCK` quando a trava muda), na mesma transação, e
  `UsageNotifier.levelChanged(...)`. Implementação agora: `PanelOnlyNotifier` (nada a enviar; o painel lê o estado).
  Quando a spec do Resend existir, entra `EmailUsageNotifier` para os Administradores ativos — sem mudar `usage`.
- **Banner no painel**: o layout do painel, para Administrador, pede `GET /admin/usage/alerts` (barato, sem cache) e
  mostra a faixa amarela (≥ 70%) ou vermelha (≥ 90% ou travado) com link para a tela.

## R8. Configuração (FR-013)

```yaml
zsu.usage:
  refresh: 30m
  resources:
    fotos.espaco:      { label: "Fotos — espaço", unit: BYTES, limit: 10GB, period: NONE, lock-at: 95 }
    fotos.gravacoes:   { label: "Fotos — gravações", unit: OPERATIONS, limit: 1000000, period: MONTH, lock-at: 95 }
    fotos.leituras:    { label: "Fotos — leituras", unit: OPERATIONS, limit: 10000000, period: MONTH }   # só aviso
    ia.<modelo>.dia:    { label: "IA — pedidos no dia", unit: REQUESTS, limit: <RPD>, period: DAY_PACIFIC, lock-at: 100 }
    ia.<modelo>.minuto: { label: "IA — pedidos no minuto", unit: REQUESTS, limit: <RPM>, period: MINUTE, lock-at: 100 }
    disco:             { label: "Disco do servidor", unit: BYTES, period: NONE }   # limite = tamanho do disco
  warn-at: 70
  critical-at: 90
```

Valores de RPM/RPD dos modelos ficam no `.env` de produção (`USAGE_AI_*`), porque mudam com o modelo e o plano.
Recurso sem configuração não aparece. Sem `lock-at` = só aviso.

## R9. Tela e permissão (FR-001, FR-014)

- **Decisão**: `/admin/uso` ("Uso dos planos"), item no menu do grupo da Equipe/Configurações, permissão
  `settings.manage` (só Administrador). API `GET /api/v1/admin/usage` e `POST /api/v1/admin/usage/refresh`
  (`settings.manage`); `GET /api/v1/admin/usage/alerts` (`settings.manage`, para o banner).
- Modo demonstração: mocks com números de exemplo (constituição IV).

## R10. Migração e impacto na spec 002

- **Decisão**: `V12__usage_monitor.sql` (esta spec vem antes da 002). A spec 002 passa a usar **V13** e a respeitar
  `QuotaGuard` (importação de histórico e geração em lote adiam em vez de falhar). Atualizar `specs/002-*`.
