# Pesquisa: Conexão com a conta do Instagram

Decisões da fase 0 do plano. Cada uma: **Decisão**, **Por quê**, **Alternativas**.

## R1. Tipo de acesso da Meta

- **Decisão**: "API do Instagram com login unificado" (Business Login for Instagram). Acesso = token de usuário do
  sistema (SUAT) do portfólio empresarial Zona Sul Urgente, sem vencimento, permissão só `instagram_basic`. Chamadas em
  `https://graph.facebook.com/v27.0/{ig-user-id}/...` com `Authorization: Bearer`.
- **Por quê**: é a única configuração que a Meta oferece para apps novos (a "com login do Instagram" não está mais
  disponível; a "com login do Facebook" está obsoleta e exige Página). Testado em 2026-11-16 com a conta reserva: o
  token tem 251 caracteres, começa com `EAA`, lê a conta (`id, username, name, media_count`) e os posts.
- **Alternativas**: login do Facebook com Página (obsoleto, exige Página ligada); botão "Conectar com Instagram"
  (OAuth) — exige URL pública HTTPS; fica para produção (FR-019).

## R2. Como identificar a conta ao ligar

- **Decisão**: o Administrador cola o **acesso** e o **ID da conta do Instagram** (mostrado no painel da Meta ao lado do
  nome, ex.: `17841441782026305`). A API valida na hora com `GET /{id}?fields=id,username,name,media_count`.
- **Por quê**: o token é de um usuário de sistema; `GET /me` devolve o usuário de sistema, e `me/accounts`,
  `me/assigned_business_asset_groups` vêm vazios e `me/businesses` exige outra permissão (testado). Não dá para
  descobrir a conta só pelo token com a permissão mínima.
- **Alternativas**: pedir `business_management` para descobrir a conta — amplia o acesso sem necessidade.

## R3. Campos dos posts e mídia

- **Decisão**: listar com `GET /{id}/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,
  permalink,timestamp,children{id,media_type,media_url,thumbnail_url}&limit=25`, paginando por `paging.next`.
  Foto principal: `IMAGE` → `media_url`; `VIDEO` (inclusive reels) → `thumbnail_url`; `CAROUSEL_ALBUM` → primeiro
  filho (foto: `media_url`; vídeo: `thumbnail_url`). Guardamos todas as imagens do carrossel e a capa dos vídeos;
  **não guardamos arquivos de vídeo** (o armazenamento de fotos só trata imagens).
- **Por quê**: testado com a conta reserva — legenda, `media_url`, `thumbnail_url` e `permalink` vêm nos reels. A
  documentação manda tratar `media_url` como opcional (vídeo com música licenciada) e os endereços da Meta não são
  permanentes, por isso a cópia (FR-008, FR-010).
- **Alternativas**: guardar só o endereço da Meta (expira); guardar o vídeo (fora do escopo; o site não hospeda vídeo
  próprio).

## R4. Onde a sincronização roda

- **Decisão**: `@Scheduled` a cada 15 min (`zsu.instagram.sync-interval`), no mesmo padrão de `ScheduledPublisher`,
  desligado quando `zsu.jobs.enabled=false` (testes chamam o método direto). A varredura só insere as linhas novas na
  fila e enfileira um job `INSTAGRAM_IMPORT` por post; o job baixa as mídias e pede o rascunho à IA.
- **Por quê**: a varredura fica rápida e sem IA; baixar mídia e chamar a IA são lentos e falham às vezes — a fila de
  jobs (BE-010) já dá nova tentativa com espera crescente, idempotência e recuperação de job travado. Só chamadas de
  saída: funciona local (FR-018).
- **Alternativas**: webhooks da Meta (exigem URL pública; produção); fazer tudo dentro da varredura (uma IA lenta
  travaria a sincronização inteira).

## R5. Quem é o autor do rascunho gerado pela sincronização

- **Decisão**: um ator de sistema `AuthenticatedUser(id = null, name = "Sincronização do Instagram", role = "SYSTEM")`
  com as permissões de Repórter para notícias (`news.create`, `news.edit.own`, `news.mark_urgent`, `tags.manage`).
  `created_by` fica nulo (a coluna aceita); a auditoria usa `recordSystem`. A redação vê a notícia como qualquer
  rascunho e edita.
- **Por quê**: não cria conta falsa no banco nem depende de um Administrador continuar ativo. Mesmas regras do editor
  (urgente e tópicos só se a permissão existe), sem publicar nada (constituição VII).
- **Alternativas**: agir como o Administrador que ligou a conta (quebra se ele for desativado e mistura autoria);
  criar um usuário "robô" no banco (mais uma conta para proteger).

## R6. Deduplicação entre importação manual e sincronização

- **Decisão**: chave = **link** (`permalink`, já `UNIQUE`), normalizado para `https://www.instagram.com/{p|reel}/{codigo}/`.
  Nova coluna `ig_media_id` (`UNIQUE`, nula nos manuais). Se a varredura encontra um link que já está na fila (manual),
  só preenche `ig_media_id`, a conta e as mídias que faltam; não cria outra linha nem outro rascunho.
- **Por quê**: o ID do post manual é o código do link; o da API é o ID numérico da Meta — só o link é comum aos dois.
  A Meta devolve reels como `/reel/{codigo}/` (testado), o mesmo formato que a importação manual aceita.
- **Alternativas**: trocar o ID dos manuais pelo ID da Meta (mexe na chave primária e nas referências).

## R7. Mudança de legenda e posts apagados

- **Decisão**: a cada ciclo, a varredura lê os posts dos **últimos 30 dias** (para nas páginas mais antigas) e compara a
  legenda dos já importados: diferente → `CHANGED_AT_SOURCE` + `current_caption` (a original nunca muda). Post importado
  dos últimos 30 dias que não veio na lista → confirmação com `GET /{media-id}`; erro "não existe" → `REMOVED_AT_SOURCE`.
  Nenhum dos dois mexe na notícia.
- **Por quê**: a API não avisa edição/remoção sem webhooks; 30 dias cobrem o período em que uma notícia ainda é
  atual, com poucas chamadas (1–3 páginas por ciclo).
- **Alternativas**: conferir todos os posts sempre (centenas de chamadas); webhooks (produção).

## R8. Guarda do acesso

- **Decisão**: cifrar com o `SecretCipher` (AES-256-GCM, chave `TOTP_ENCRYPTION_KEY`) já usado nos segredos do 2FA.
  A API nunca devolve o token; a tela mostra só os 4 últimos caracteres.
- **Por quê**: requisito do pedido ("como o 2FA"); reaproveita a chave e a rotina testadas.
- **Alternativas**: chave nova só para o Instagram (mais uma variável sem ganho real agora).

## R9. Falhas, limites e aviso no painel

- **Decisão**: resposta 190 (token inválido/revogado) ou 10/200 (permissão) → conexão `REVOKED`, a varredura para e o
  painel avisa; auditoria `INSTAGRAM_ACCESS_LOST`. Erros passageiros (5xx, tempo esgotado, 4/17/32/613 de limite) →
  `last_error` + contador; aviso só a partir de **3 falhas seguidas** (≈45 min). Sucesso zera o contador.
- **Por quê**: cumpre FR-015 sem alarme falso; os códigos são os da documentação de erros da Graph API.
- **Alternativas**: avisar na primeira falha (ruído quando a Meta oscila).

## R10. Regra de publicação

- **Decisão**: remover `publishRule` (`URGENT_AUTO`) do tipo `InstagramConnection` e do texto da tela; tudo vira
  rascunho, sempre.
- **Por quê**: constituição VII (a IA ajuda, a redação decide) e FR-011. O campo era só de demonstração.
- **Alternativas**: manter desligado por padrão — deixaria aberta uma porta que a constituição proíbe.

## R11. Importação manual

- **Decisão**: continua igual (FR-017): entra como `NEW` e o rascunho sai pelo botão "Gerar agora". A nota da fila
  passa a dizer "Clique em Gerar agora" para posts manuais e "a IA gera automaticamente" só para os sincronizados.
- **Por quê**: o texto atual promete geração automática que não existe para o manual (achado na leitura do código).
- **Alternativas**: gerar o manual automaticamente também (muda comportamento fora do escopo da spec).
