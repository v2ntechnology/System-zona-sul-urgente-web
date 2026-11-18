# Pesquisa: Importar posts antigos do Instagram

Decisões da fase 0. Cada uma: **Decisão**, **Por quê**, **Alternativas**. Base: o código da spec 001 (módulo
`instagram`, fila `job_queue`, `InstagramGraphClient`).

## R1. Como a importação roda em segundo plano

- **Decisão**: um registro `instagram_history_imports` por pedido e um job `INSTAGRAM_HISTORY_PAGE` por página da Meta
  (25 posts). Cada job lê uma página, grava os posts do período que não estão excluídos, atualiza os contadores e
  enfileira a próxima página com o cursor `after`. Antes de ler, confere se a importação ainda está `RUNNING`
  (interromper = mudar a situação; a próxima página não roda).
- **Por quê**: reaproveita a fila (BE-010) com nova tentativa, recuperação de job travado e várias instâncias; cada
  passo é curto (segundos), então interromper vale em menos de 1 minuto (FR-008) e o andamento é atualizado a cada
  página (SC-003). Sobrevive a reinício da API (FR-006).
- **Alternativas**: uma thread longa lendo tudo (perde o andamento num reinício e não dá para interromper com
  segurança); ler tudo dentro da requisição (estoura tempo).

## R2. Escolha do que importar (FR-002)

- **Decisão**: período `from`/`to` (datas, fuso de Brasília; `from` nulo = desde o primeiro post; `to` nulo = até agora)
  + lista opcional de IDs da Meta **excluídos**. A pré-visualização é um endpoint que lê uma página da Meta por vez
  dentro do período e marca quais já estão na fila; a tela carrega mais páginas sob demanda.
- **Por quê**: guardar só as exclusões (geralmente poucas) é leve mesmo para o histórico inteiro; quem não abre a lista
  manda zero exclusões.
- **Miniaturas da lista**: vêm do endereço temporário da Meta, carregado direto pelo navegador (só imagem pública do
  CDN, não a nossa API). Se a lista ficar aberta por horas e a miniatura expirar, a tela mostra um marcador sem imagem.
- **Alternativas**: guardar os IDs incluídos (lista enorme para "todo o histórico").

## R3. Posts do histórico não viram rascunho sozinhos (FR-004)

- **Decisão**: os posts entram com `source = 'API'` e `history_import_id` preenchido. O `InstagramImportJob` baixa a
  mídia de todos, mas só gera rascunho se `source = 'API'` **e** `history_import_id IS NULL`. A fila mostra a marca
  "Antigo" e a nota "clique em Gerar agora ou gere em lote".
- **Por quê**: mantém o caminho de mídia da spec 001 e separa a regra de geração por um único campo.
- **Alternativas**: novo `source = 'HISTORY'` (mexe no `CHECK` e nas regras que já tratam API).

## R4. Chamadas à Meta e validade dos endereços de mídia

- **Decisão**: o job de página passa as mídias da lista (endereços de foto/capa/carrossel e `alt_text`) no payload do
  `INSTAGRAM_IMPORT`; o job tenta baixar por esses endereços e só chama `GET /{media-id}` se o download falhar
  (endereço expirado). Vale também para a varredura normal.
- **Por quê**: sem isso, 434 posts = 434 chamadas extras à Meta, perto do limite por hora. Com isso, o histórico inteiro
  custa ~18 chamadas de lista. Os endereços da Meta duram horas — suficiente para jobs que rodam em minutos.
- **Alternativas**: sempre buscar o post de novo (simples, mas caro em chamadas).

## R5. Falhas durante a importação (FR-009)

- **Decisão**: acesso perdido (`AccessRevokedException`) → importação `FAILED` na hora + regra da spec 001 (conexão
  `REVOKED`, aviso). Limite de chamadas/5xx (`TransientGraphException`) → o job de página falha e a fila tenta de novo
  com espera crescente; esgotadas as tentativas (DEAD), a importação vira `FAILED` com o motivo. Conta desligada ou
  trocada → `CANCELLED`.
- **Por quê**: limite da Meta é comum em leitura longa; esperar resolve. Acesso perdido não resolve sozinho.
- **Alternativas**: falhar na primeira oscilação (frustra importação grande).

## R6. Geração em lote no ritmo da IA (FR-010, FR-011)

- **Decisão**: `POST /posts/generate-batch` cria um `instagram_generation_batches` com os itens elegíveis (`status IN
  (NEW, ERROR)` e sem notícia; os outros contam como pulados) e enfileira um job `INSTAGRAM_GENERATE` por post, com
  `run_at` escalonado: item *i* roda em `now + i × (60 / batch-per-minute)` segundos (padrão 4/min → a cada 15 s).
  `JobQueue` ganha `enqueue(type, payload, runAt, maxAttempts)`.
- **Por quê**: o ritmo fica garantido pela própria fila, sem processo a mais; o lote sobrevive a reinício.
- **Alternativas**: um job que gera tudo em sequência dormindo entre um e outro (prende o worker por minutos).

## R7. Limite da IA atingido no meio do lote

- **Decisão**: no job `INSTAGRAM_GENERATE`, `AiUnavailableException` (429/tempo esgotado do Gemini) **não** marca
  "Erro": o job falha e a fila tenta de novo com espera crescente até 30 min, com `max_attempts = 48` (~1 dia), o que
  cobre o limite diário do plano grátis. Saída inválida da IA (`AiOutputException`) → "Erro" com Reprocessar (como
  hoje). O botão individual "Gerar agora" continua igual (erro imediato, a pessoa tenta depois). Na **última
  tentativa** (antes de o job virar DEAD), o job marca o post como "Erro" ("A IA não respondeu depois de várias
  tentativas; reprocesse"), para o post não ficar parado em "Novo" e o lote não mostrar "pendente" para sempre.
- **Por quê**: FR-011 ("esperar e continuar depois") sem perder posts.
- **Alternativas**: parar o lote inteiro no primeiro 429 (exige alguém reiniciar).

## R8. Autoria dos rascunhos do lote

- **Decisão**: ator de sistema `BatchActor` = `AuthenticatedUser(id = null, name = "Lote de <nome de quem pediu>",
  role = "SYSTEM", permissões `news.create`, `news.edit.own`, `tags.manage` — **sem** `news.mark_urgent`)`. Sem essa
  permissão, `toNewsDraft` descarta a marca de urgente da IA (`d.urgent() && canUrgent`). Motivo: a faixa de urgentes usa
  a data de **publicação** (últimas 6 h); um post antigo publicado hoje entraria nela (análise de 2026-11-16, C1). Quem pediu fica no lote e na auditoria `AI_BATCH`.
- **Por quê**: o job não tem pessoa logada; montar as permissões reais exigiria o módulo `instagram` ler tabelas de
  `auth` (constituição V). Mesmo padrão do `SyncActor` da spec 001.
- **Alternativas**: carregar o usuário pelo `auth` (nova interface pública só para isso).

## R9. Conferência dos antigos que viraram notícia (FR-014)

- **Decisão**: além da janela de 30 dias, cada varredura confere **até 20** posts antigos com notícia, em rodízio pelo
  mais antigo conferido (`source_checked_at`), com `GET /{media-id}` (legenda nova → `CHANGED_AT_SOURCE`; não existe →
  `REMOVED_AT_SOURCE`). Isso roda **depois** da parte dos posts novos e não conta como falha da varredura se só esta
  parte falhar.
- **Por quê**: limita o custo por ciclo (≤ 20 chamadas) e não atrasa os posts novos (caso-limite da spec); 100
  notícias antigas são conferidas a cada ~75 min.
- **Alternativas**: conferir todas a cada ciclo (centenas de chamadas).

## R10. Auditoria

- **Decisão**: (migração V13, porque a spec 003 usa a V11 e a spec 004 a V12) ações novas `INSTAGRAM_HISTORY` (detalhe `event`: `start`, `cancel`, `completed`, `failed`, com
  período e contadores) e `AI_BATCH` (total, enfileirados, pulados). A V13 recria o `CHECK` de `audit_logs.action`.
- **Por quê**: FR-015; o `CHECK` fixo da V9 exige a migração (achado da spec 001).

## R12. Pendências na tela e no Dashboard (FR-016)

- **Decisão**: as contagens de "pedem ação" (página do Instagram) e de posts novos (Dashboard) excluem posts com
  `history_import_id` e sem notícia; `GET /posts/counts` ganha a chave `HISTORY` (antigos sem rascunho) para o filtro
  "Antigos".
- **Por quê**: depois de importar 434 posts, o painel "gritaria" centenas de pendências que não são trabalho urgente.

## R11. Permissões

- **Decisão**: importar/interromper/pré-visualizar = `instagram.settings` (Administrador). Lote = `instagram.review`
  (quem já pode clicar em "Gerar agora").
- **Por quê**: FR-001 e FR-010.

## Revisão (2026-11-18): spec 004 vem antes

A spec 004 (monitor dos planos gratuitos) foi implementada antes desta e usa a V12; esta passa a ser a **V13**. A
importação do histórico e a geração em lote também passam a respeitar o `QuotaGuard` da spec 004: com a trava das
fotos ou da IA ligada, os jobs **adiam** (`QuotaDeferredException`) em vez de falhar, e os posts aparecem como
"Aguardando espaço" ou "Aguardando a IA".
