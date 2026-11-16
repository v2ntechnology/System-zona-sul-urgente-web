# Especificação: Conexão com a conta do Instagram

**Pasta da spec**: `specs/001-conexao-instagram`

**Criada em**: 2026-11-16

**Situação**: Rascunho (esclarecida)

**Itens do backlog**: BE-013 (importação do Instagram) e conclusão do FE-155 (fila do Instagram no painel)

**Pedido**: "Conexão do painel com a conta do Instagram (BE-013, completa o FE-155). Hoje a fila do Instagram só
recebe posts colados à mão (link + legenda), sem a foto, e a tela mostra 'não conectado'. Queremos: (1) ligar uma
conta profissional do Instagram ao painel (só Administrador); no desenvolvimento usaremos a conta reserva do Zona Sul
Urgente e, quando for para a VPS, trocaremos para a conta oficial sem mudar código; (2) buscar sozinho os posts novos
da conta de tempos em tempos e colocá-los na fila, sem duplicar, com a IA gerando o rascunho como já acontece na
importação manual; (3) trazer a mídia do post (foto, fotos do carrossel, capa do vídeo) e guardar no armazenamento de
fotos do sistema, para o rascunho já nascer com foto principal e crédito; (4) perceber quando a legenda muda ou o post
é apagado no Instagram e marcar na fila, sem mexer na notícia sozinho; (5) tela de conexão mostrando a conta ligada,
a última sincronização, erros e quando o acesso vence; o acesso dura cerca de 60 dias e deve ser renovado
automaticamente antes de vencer, avisando no painel se a renovação falhar (revisto no teste com a conta reserva: o
acesso do login unificado não vence); (6) a importação manual continua
existindo. Restrições: a IA continua só gerando rascunho (1 post → no máximo 1 notícia); só conteúdo público vai para
a IA; o acesso à conta é segredo; tudo deve funcionar localmente. Em aberto: se a legenda é retornada nesse tipo de
acesso da Meta; vídeos com música licenciada podem vir sem o arquivo de mídia."

## Esclarecimentos

### Sessão de 2026-11-16

- P: Na primeira conexão (ou troca de conta), quais posts antigos entram na fila? → R: os dos últimos 7 dias.
- P: Como o Administrador liga a conta? → R: colando o acesso gerado no painel da Meta agora; o botão "Conectar com
  Instagram" entra depois, com o site publicado.

### Teste com a conta reserva (2026-11-16)

- A Meta só oferece agora o "login unificado": o acesso pertence ao portfólio empresarial (Zona Sul Urgente), é gerado
  no painel do app e **não vence** (expiração "Nunca"). Ele deixa de funcionar se for revogado, se o app for removido do
  portfólio ou se a conta mudar de portfólio.
- A **legenda vem** completa, junto com tipo, arquivo de mídia, capa do vídeo, link e data. Há paginação.
- A conta reserva tem 434 posts; os 4 dos últimos 7 dias eram todos **reels** (vídeo), com arquivo e capa. Para a
  maioria dos posts, a foto principal do rascunho será a capa do vídeo.

## Contexto

Boa parte das notícias do Zona Sul Urgente nasce como post no Instagram. Hoje alguém da redação precisa copiar o link
e a legenda de cada post e colar no painel; a foto não vem, e quem revisa o rascunho tem que baixar a imagem do
Instagram e subir de novo. A tela já existe e a fila já foi pensada para receber posts automaticamente (situações
"Alterado no Instagram" e "Removido do Instagram"), mas a ligação com a conta nunca foi feita.

## Cenários de uso e testes *(obrigatório)*

### História 1 — Ligar a conta do Instagram ao painel (Prioridade: P1)

O Administrador abre a tela do Instagram, entra na área de conexão e liga a conta profissional do jornal. A partir daí
a tela mostra qual conta está ligada (nome de usuário), desde quando, quando foi a última sincronização e até quando
vale o acesso. Ele pode desligar a conta ou trocar por outra (ex.: da conta reserva para a oficial) sem ajuda de
desenvolvedor.

**Por que esta prioridade**: sem a conta ligada nada mais funciona; é a base das outras histórias.

**Teste independente**: ligar a conta reserva e ver a tela mostrar o nome de usuário correto e a validade do acesso;
desligar e ver a tela voltar a "não conectado".

**Cenários de aceite**:

1. **Dado** que nenhuma conta está ligada, **quando** o Administrador liga a conta com um acesso válido, **então** a
   tela mostra o nome de usuário da conta, a data em que foi ligada e a validade do acesso (ou "não vence").
2. **Dado** um acesso inválido ou de uma conta que não é profissional, **quando** o Administrador tenta ligar, **então**
   a conta não é ligada e a tela explica o motivo em português simples.
3. **Dado** uma conta ligada, **quando** o Administrador liga outra conta, **então** a nova substitui a anterior, os
   posts já na fila continuam lá e a troca fica registrada na auditoria.
4. **Dado** um Editor ou Repórter, **quando** abre a tela do Instagram, **então** vê a situação da conexão, mas não
   consegue ligar, trocar ou desligar a conta.

---

### História 2 — Posts novos entram sozinhos na fila, com foto (Prioridade: P1)

Depois de ligada a conta, o sistema confere a conta de tempos em tempos e coloca cada post novo na fila, já com a
legenda, o link, a data e a mídia (foto; fotos do carrossel; capa do vídeo). A IA gera o rascunho como já acontece na
importação manual, e o rascunho nasce com a foto principal e o crédito preenchidos. A redação só revisa e publica.

**Por que esta prioridade**: é o ganho principal — acaba com o copiar e colar e com o trabalho de baixar e subir a foto.

**Teste independente**: publicar um post de teste na conta reserva e, sem ninguém tocar no painel, ver o post aparecer
na fila e o rascunho aparecer em Notícias com a foto principal.

**Cenários de aceite**:

1. **Dado** uma conta ligada, **quando** um post novo é publicado nela, **então** ele aparece na fila em até um ciclo
   de sincronização, com legenda, link, data de publicação, tipo (foto, vídeo ou carrossel) e a mídia guardada no
   sistema.
2. **Dado** um post novo na fila, **quando** a IA termina, **então** existe uma notícia em rascunho com origem Instagram,
   foto principal (a foto do post, a primeira do carrossel ou a capa do vídeo) e crédito da foto preenchido.
3. **Dado** um post que já foi colado à mão na fila, **quando** a sincronização o encontra, **então** ele não é
   duplicado nem gera uma segunda notícia; o post da fila passa a ter a mídia, se ainda não tinha.
4. **Dado** que a sincronização roda várias vezes, **quando** não há posts novos, **então** nada muda na fila.
5. **Dado** um vídeo que a Meta entrega sem o arquivo (ex.: música licenciada), **quando** ele entra na fila, **então**
   usa a capa do vídeo como foto; sem capa, entra sem foto e a fila avisa que a foto precisa ser escolhida à mão.

---

### História 3 — Avisar quando o post muda ou some no Instagram (Prioridade: P2)

Se a legenda de um post já importado for editada no Instagram, ou se o post for apagado, a fila marca o post como
"Alterado no Instagram" ou "Removido do Instagram". A notícia não é alterada sozinha: a redação compara e decide.

**Por que esta prioridade**: evita que uma correção ou remoção feita no Instagram passe despercebida no site, mas o
fluxo principal funciona sem ela.

**Teste independente**: editar a legenda de um post já importado na conta reserva e ver a fila marcá-lo como alterado,
com a comparação entre a legenda original e a nova; apagar o post e ver a fila marcá-lo como removido.

**Cenários de aceite**:

1. **Dado** um post importado, **quando** a legenda muda no Instagram, **então** a fila o marca como "Alterado no
   Instagram", guarda a legenda nova ao lado da original (que nunca é sobrescrita) e a notícia continua igual.
2. **Dado** um post importado, **quando** ele é apagado no Instagram, **então** a fila o marca como "Removido do
   Instagram" e a notícia continua igual.
3. **Dado** um post marcado como alterado, **quando** alguém clica em "Marcar como revisado", **então** o aviso some
   até a próxima mudança na origem.

---

### História 4 — Problemas da integração visíveis no painel (Prioridade: P2)

O acesso à conta não vence com o tempo, mas pode parar de funcionar (acesso revogado no painel da Meta, app removido
do portfólio, conta movida para outro portfólio, Instagram fora do ar). Quando isso acontece, o painel avisa de forma
clara, com o que fazer, em vez de a integração parar em silêncio.

**Por que esta prioridade**: sem aviso, a fila simplesmente deixa de receber posts e ninguém percebe; mas o fluxo
principal funciona sem ela.

**Teste independente**: revogar o acesso no painel da Meta e ver o aviso aparecer no painel no ciclo seguinte; gerar
um acesso novo, colar e ver a sincronização voltar.

**Cenários de aceite**:

1. **Dado** que a sincronização falha porque o acesso foi revogado, **quando** alguém com acesso à fila abre o painel,
   **então** vê um aviso com o problema e a última sincronização que deu certo; o Administrador vê o que fazer para
   religar a conta.
2. **Dado** uma falha passageira (Instagram fora do ar, limite de chamadas), **quando** a sincronização falha,
   **então** tenta de novo nos próximos ciclos sem avisar à toa; o aviso só aparece se a falha persistir.
3. **Dado** que a conta foi desligada ou o acesso revogado, **quando** a sincronização tentaria rodar, **então** nada é
   buscado e a importação manual continua funcionando.

### Casos-limite

- Primeira conexão ou troca de conta: entram os posts dos últimos 7 dias (FR-006); se forem muitos, todos entram sem
  travar o painel, e a IA gera os rascunhos aos poucos.
- Post colado à mão com o mesmo link de um post que a sincronização trouxe: um só item na fila (comparação pelo link).
- Carrossel com mais fotos do que o necessário: todas ficam guardadas; a primeira é a foto principal.
- Post que parece publicidade: como na fila de hoje, a IA sinaliza, o rascunho é criado assim mesmo e o sinal fica
  registrado na auditoria; a redação decide se publica.
- A IA falha ou está fora do ar: o post fica na fila como "Erro" e pode ser reprocessado, como hoje.
- Troca de conta (reserva → oficial): posts da conta anterior continuam na fila e nas notícias; a sincronização passa a
  olhar só a conta nova.
- Muitos posts de uma vez (ex.: a conta publicou 20 posts num dia): todos entram, sem estourar os limites da Meta e
  sem travar o painel.
- A Meta deixa de entregar a legenda (não acontece hoje): o post entra mesmo assim, marcado para a legenda ser colada à
  mão (ver Suposições).
- Acesso revogado no painel da Meta ou app removido do portfólio: a sincronização para e o painel avisa (História 4).

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **FR-001**: O sistema DEVE permitir que só quem tem a permissão de configurar o Instagram (Administrador) ligue,
  troque ou desligue a conta; os demais perfis com acesso à fila só veem a situação.
- **FR-002**: O sistema DEVE aceitar apenas contas profissionais do Instagram e recusar acessos inválidos ou vencidos
  com uma mensagem clara.
- **FR-003**: O sistema DEVE guardar o acesso à conta como segredo: cifrado no banco, nunca exibido inteiro na tela,
  nunca no código, nos logs ou na auditoria.
- **FR-004**: O sistema DEVE mostrar na tela de conexão: nome de usuário da conta, quando foi ligada, última
  sincronização com sucesso, último erro (se houver) e a validade do acesso (ou "não vence").
- **FR-005**: O sistema DEVE buscar os posts da conta ligada periodicamente (padrão: a cada 15 minutos) e colocar cada
  post novo na fila com legenda, link, data de publicação, tipo e quantidade de mídias.
- **FR-006**: Na primeira conexão (e em toda troca de conta), o sistema DEVE importar os posts publicados nos últimos
  7 dias, além dos que forem publicados dali em diante. Posts mais antigos não entram na fila.
- **FR-007**: O sistema NÃO DEVE duplicar posts: a comparação é pelo link do post, valendo também entre importação
  manual e sincronização.
- **FR-008**: O sistema DEVE baixar a mídia de cada post importado (foto, todas as fotos do carrossel, capa do vídeo) e
  guardá-la no armazenamento de fotos do sistema, porque os endereços da Meta não são permanentes.
- **FR-009**: O rascunho gerado a partir de um post sincronizado DEVE nascer com foto principal (foto do post, primeira
  do carrossel ou capa do vídeo) e crédito no formato "Foto: Reprodução/Instagram @<conta>".
- **FR-010**: Quando a Meta não entregar o arquivo de um vídeo, o sistema DEVE usar a capa; sem capa, o post entra sem
  foto e a fila indica que a foto precisa ser escolhida à mão.
- **FR-011**: A geração do rascunho pela IA DEVE seguir as regras atuais: só rascunho, no máximo uma notícia por post,
  só o conteúdo público do post vai para a IA, falha vira "Erro" com opção de reprocessar.
- **FR-012**: O sistema DEVE detectar mudança de legenda em posts já importados e marcá-los como "Alterado no
  Instagram", guardando a legenda nova sem sobrescrever a original e sem alterar a notícia.
- **FR-013**: O sistema DEVE detectar posts importados que foram apagados no Instagram e marcá-los como "Removido do
  Instagram", sem alterar a notícia.
- **FR-014**: Se o acesso colado tiver data de validade, o sistema DEVE mostrá-la e avisar o Administrador a partir de
  10 dias do vencimento. O acesso do login unificado não vence; não há renovação automática nesta spec.
- **FR-015**: Quando a sincronização falhar, o sistema DEVE tentar de novo nos ciclos seguintes em falhas passageiras e,
  se a falha persistir ou o acesso tiver sido revogado, avisar no painel, mostrar a última sincronização com sucesso e
  parar de tentar até a conta ser religada.
- **FR-016**: Ligar, trocar e desligar a conta, e a perda de acesso detectada pela sincronização, DEVEM ir para a
  auditoria (quem, quando, qual conta — nunca o acesso em si).
- **FR-017**: A importação manual (link + legenda) DEVE continuar funcionando com ou sem conta ligada.
- **FR-018**: A sincronização DEVE funcionar no ambiente local de desenvolvimento, sem depender de o site estar
  publicado na internet.
- **FR-019**: O Administrador DEVE ligar a conta colando no painel o acesso gerado no painel de desenvolvedor da Meta.
  O sistema confere o acesso na hora (conta profissional, acesso válido) antes de guardar. Um botão "Conectar com
  Instagram" com o login da Meta fica para quando o site estiver publicado (a Meta exige endereço público seguro).

### Entidades

- **Conexão do Instagram**: a conta ligada ao painel (uma por vez). Nome de usuário, identificador da conta na Meta,
  acesso (segredo), validade do acesso (pode não ter), quem ligou e quando, última sincronização com sucesso, último
  erro.
- **Post do Instagram** (já existe na fila): ganha a origem "sincronização", a mídia guardada e a referência à conta de
  onde veio.
- **Mídia do post**: cada foto (ou capa de vídeo) guardada no armazenamento do sistema, na ordem do carrossel; a
  primeira é a candidata a foto principal.

## Critérios de sucesso *(obrigatório)*

### Resultados mensuráveis

- **SC-001**: Um post publicado na conta ligada aparece na fila em até 20 minutos, sem ninguém tocar no painel.
- **SC-002**: 100% dos rascunhos gerados a partir de posts de foto ou carrossel nascem com foto principal e crédito.
- **SC-003**: Nenhum post aparece duas vezes na fila, mesmo quando foi colado à mão antes da sincronização.
- **SC-004**: O tempo da redação para transformar um post em rascunho com foto cai de alguns minutos (copiar, colar,
  baixar e subir a foto) para zero.
- **SC-005**: A integração roda por mais de 60 dias seguidos sem ninguém religar a conta.
- **SC-006**: Quando o acesso é revogado, o aviso aparece no painel no ciclo seguinte de sincronização; quando a
  sincronização falha por problema passageiro, o aviso só aparece depois de 3 ciclos seguidos com falha (FR-015).
- **SC-007**: Trocar da conta reserva para a oficial leva menos de 5 minutos e não exige mudança no sistema.

## Suposições

- No desenvolvimento usamos a conta reserva do Zona Sul Urgente; ela é (ou será convertida em) conta profissional, e
  quem desenvolve tem acesso a ela e a um app no painel de desenvolvedor da Meta ligado a ela.
- O app da Meta só lê a própria conta do jornal; por isso não deve precisar da revisão de app da Meta.
- Uma conta ligada por vez é suficiente.
- O aviso instantâneo da Meta a cada post novo (que exige o site publicado na internet) fica fora desta spec; a busca
  periódica atende o desenvolvimento e o começo da produção.
- Confirmado com a conta reserva: a legenda vem nesse tipo de acesso. Se um dia a Meta deixar de entregar, o post entra
  na fila sem legenda e a redação cola a legenda (o rascunho só é gerado depois disso).
- O acesso usado é o do login unificado: pertence ao portfólio empresarial Zona Sul Urgente e não vence. Na troca para
  a conta oficial, ela entra no mesmo portfólio e um acesso novo é gerado e colado (FR-019).
- Entram os posts do perfil (foto, vídeo — inclusive reels — e carrossel). Stories (somem em 24 horas) ficam fora.
- Comentários, curtidas e métricas dos posts ficam fora desta spec.
