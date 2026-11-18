# Especificação: Monitor de uso dos planos gratuitos

**Pasta da spec**: `specs/004-monitor-planos-gratuitos`

**Criada em**: 2026-11-17

**Situação**: Implementada (2026-11-18) — falta publicar na produção e validar com os números reais (T027)

**Ordem**: depois do primeiro deploy na VPS; antes do vídeo do Instagram (spec 005) e da importação de posts antigos
(spec 002), que é a que mais gasta fotos e IA

**Itens do backlog**: OPS-002 (hospedagem na VPS), BE-012 (fotos), BE-014 (IA editorial), BE-013 (Instagram)

**Pedido**: "Monitor de uso dos planos gratuitos (área do Administrador) — vem antes do vídeo do Instagram (que vira a
spec 005). O site vai para produção numa VPS com fotos no Cloudflare R2 (plano grátis: 10 GB/mês de armazenamento, 1
milhão de operações de gravação e 10 milhões de leitura por mês, saída grátis) e IA pelo Gemini no plano grátis
(limites de pedidos por minuto e por dia). O cliente não quer nunca pagar por ultrapassar a parte gratuita. Queremos:
(1) uma tela no painel, só para Administrador, mostrando o uso atual de cada recurso em relação ao limite grátis (R2
armazenamento, gravações e leituras do mês; pedidos à IA no dia e no minuto; disco do servidor), com quando foi a
última leitura; (2) avisos dentro do painel quando passar de 70% e de 90% de qualquer limite; (3) trava automática:
perto do limite do armazenamento do R2 (ex.: 95%) o sistema recusa fotos novas com mensagem clara (a notícia pode ser
salva sem foto), e perto do limite diário da IA a geração de rascunho espera o dia seguinte em vez de falhar ou gerar
custo; a importação do Instagram respeita a trava. Os números do R2 devem vir da própria Cloudflare (dados de uso da
conta), conferidos com o que o sistema sabe das fotos que gravou; os da IA, contados pelo próprio sistema. Tudo vai
para a auditoria quando uma trava liga ou desliga. A ideia é depois reaproveitar esse monitor em outros projetos
(portfólio), então os limites devem ser configuráveis, não fixos no código. Em aberto: se a trava do R2 deve ser 95%
ou outro valor; quem recebe os avisos (só no painel ou também por e-mail); se o Editor também vê a tela."

## Esclarecimentos

### Sessão de 2026-11-18

- P: Quem vê a tela de uso? → R: **Só o Administrador** (1A). Os outros perfis só veem a mensagem da trava quando ela
  os impede de enviar foto.
- P: Por onde chegam os avisos de 70% e 90%? → R: **Painel e e-mail para os Administradores** (2B). O e-mail depende
  do serviço de envio de e-mails (Resend, spec própria); até ele existir, só o aviso no painel.
- P: Em que ponto a trava das fotos liga? → R: **95%** (3A) do limite, configurável.
- P: Com a trava das fotos ligada, dá para publicar sem foto? → R: **Não** (opção A): publicar continua exigindo foto
  (regra editorial do site); a notícia fica salva como rascunho até a foto poder entrar.

## Contexto

O site novo roda com serviços de plano gratuito: as fotos ficam num armazenamento na nuvem com cota mensal grátis e a
IA que escreve os rascunhos tem limite de pedidos. Passar da cota gera cobrança no cartão cadastrado, sem aviso. O
cliente quer a garantia de que isso **nunca** aconteça e de que alguém veja com antecedência quando o uso estiver
crescendo. Hoje ninguém da equipe tem como saber quanto já foi usado.

| Recurso | Limite grátis (referência, configurável) | O que mais consome |
|---|---|---|
| Fotos — espaço guardado | 10 GB | Fotos enviadas no painel e trazidas do Instagram |
| Fotos — gravações no mês | 1 milhão | Cada foto gravada (com suas versões) |
| Fotos — leituras no mês | 10 milhões | Leitores abrindo fotos que não estavam no cache |
| IA — pedidos por minuto e por dia | Conforme o modelo usado | Rascunhos do Instagram, sobretudo em lote |
| Disco do servidor | Tamanho do plano da VPS | Banco, backups e versões do sistema |

## Cenários de uso e testes *(obrigatório)*

### História 1 — Ver quanto já foi usado (Prioridade: P1)

O Administrador abre a tela de uso no painel e vê, para cada recurso, quanto já foi usado, o limite grátis, a
porcentagem e quando o número foi atualizado pela última vez.

**Por que esta prioridade**: sem enxergar o uso, ninguém consegue agir antes do limite.

**Teste independente**: com fotos já guardadas e alguns rascunhos gerados, abrir a tela e conferir que os números
batem com o painel da Cloudflare e com a contagem de rascunhos do dia.

**Cenários de aceite**:

1. **Dado** um Administrador, **quando** abre a tela de uso, **então** vê cada recurso com usado, limite, porcentagem
   em barra e a hora da última leitura.
2. **Dado** que a leitura dos números da nuvem falhou, **quando** a tela é aberta, **então** mostra o último número
   conhecido com a hora em que foi lido e um aviso de que está desatualizado — nunca um número inventado.
3. **Dado** um perfil sem permissão, **quando** procura a tela, **então** ela não aparece no menu e o endereço responde
   "não encontrado". Só o Administrador vê a tela e os avisos.

---

### História 2 — Ser avisado antes do limite (Prioridade: P1)

Quando qualquer recurso passa de 70% e depois de 90% do limite, quem administra é avisado sem precisar abrir a tela.

**Por que esta prioridade**: o uso cresce aos poucos; o aviso precisa chegar enquanto ainda dá para agir (apagar fotos
velhas, pausar importações ou decidir pagar).

**Teste independente**: simular o uso das fotos em 71% e em 91% e ver os avisos certos aparecerem uma vez cada.

**Cenários de aceite**:

1. **Dado** um recurso que passa de 70%, **quando** a leitura acontece, **então** aparece um aviso amarelo no painel
   para quem administra, com o recurso, a porcentagem e o que fazer.
2. **Dado** um recurso que passa de 90%, **quando** a leitura acontece, **então** o aviso fica vermelho e destacado.
3. **Dado** um aviso já mostrado, **quando** o uso continua no mesmo nível, **então** não é repetido a cada leitura; um
   aviso novo só sai quando o nível muda (70 → 90, ou volta para baixo de 70).
4. **Dado** o começo de um mês novo, **quando** as contagens mensais zeram, **então** os avisos desses recursos somem
   sozinhos.

O canal dos avisos: no painel e por e-mail para cada Administrador ativo (uma mensagem por mudança de nível). Enquanto
o envio de e-mails não estiver configurado, só o painel — sem erro.

---

### História 3 — Nunca passar do limite (Prioridade: P1)

Perto do limite, o sistema para sozinho de gastar o recurso, explica o motivo e volta a funcionar quando houver folga.

**Por que esta prioridade**: é a garantia que o cliente pediu — aviso não basta se ninguém agir a tempo.

**Teste independente**: simular o espaço das fotos no limite de trava e tentar enviar uma foto (recusada com
mensagem), salvar a notícia sem foto (funciona) e, liberando espaço, enviar de novo (aceita).

**Cenários de aceite**:

1. **Dado** o espaço das fotos no limite de trava, **quando** alguém envia uma foto, **então** o envio é recusado com
   uma mensagem clara ("O espaço gratuito de fotos está quase cheio; avise o Administrador") e a notícia pode ser
   salva como rascunho sem a foto (publicar continua exigindo foto — regra editorial do site; decisão de 2026-11-18). O limite de trava é **95%** (configurável).
2. **Dado** o espaço das fotos travado, **quando** a sincronização do Instagram encontra um post novo, **então** o post
   entra na fila **sem foto**, marcado como "aguardando espaço", e a foto é baixada depois, quando houver folga.
3. **Dado** as gravações de fotos do mês no limite de trava, **quando** alguém envia uma foto, **então** vale a mesma
   recusa do cenário 1 até o mês virar.
4. **Dado** os pedidos à IA no limite do dia, **quando** um rascunho precisa ser gerado, **então** ele espera e é
   gerado sozinho no dia seguinte, aparecendo como "aguardando a IA" — sem erro e sem custo; quem clicou em "Gerar
   agora" vê a hora prevista.
5. **Dado** os pedidos à IA no limite do minuto, **quando** chegam mais pedidos, **então** eles esperam a vez em vez de
   falhar.
6. **Dado** uma trava ligada, **quando** o uso volta para baixo do limite (foto apagada, mês ou dia novo), **então** a
   trava desliga sozinha e o que estava esperando volta a andar.
7. **Dado** que uma trava liga ou desliga, **quando** isso acontece, **então** fica registrado na auditoria com o
   recurso, o uso no momento e o limite.

---

### História 4 — Ajustar os limites sem programar (Prioridade: P3)

Os limites e as porcentagens de aviso e de trava são configuráveis, para o mesmo monitor servir quando o plano mudar
(o cliente passou a pagar, a IA trocou de modelo) e em outros projetos.

**Teste independente**: mudar o limite de espaço das fotos na configuração e ver a tela e a trava usarem o valor novo.

**Cenários de aceite**:

1. **Dado** um limite novo configurado, **quando** o sistema reinicia, **então** a tela, os avisos e as travas usam o
   valor novo.
2. **Dado** um recurso que não existe neste projeto, **quando** ele não está configurado, **então** simplesmente não
   aparece na tela.

---

### Casos-limite

- A leitura dos números da Cloudflare falha ou demora: a tela mostra o último valor conhecido e a hora; as travas usam
  o **maior** entre o último número da Cloudflare e a conta do próprio sistema (na dúvida, trava antes).
- Os números da Cloudflare chegam com atraso (minutos a horas): o sistema soma o que gravou depois da última leitura,
  para a trava não deixar passar uma rajada de envios.
- Leituras de fotos (leitores abrindo o site) não podem ser travadas sem tirar as fotos do ar: perto do limite, só
  avisam; a trava é só para gravações e espaço.
- Importação em lote do histórico do Instagram (spec 002) durante uma trava: a importação pausa a parte das fotos e
  da IA e segue sozinha quando liberar.
- Dia e mês contados no horário de Brasília para a equipe, mas o reinício das cotas segue o relógio do serviço
  (meia-noite UTC para o mês da nuvem; horário do Pacífico para o dia da IA); a tela mostra quando cada um zera.
- Foto apagada no painel: o espaço só libera quando a foto sai de fato do armazenamento.
- Disco do servidor cheio: não há trava (o sistema todo pararia); só avisos, com a sugestão do que limpar.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **FR-001**: O sistema DEVE mostrar uma tela de uso com, para cada recurso monitorado: uso atual, limite grátis,
  porcentagem, situação (normal, atenção, crítico, travado), hora da última leitura e quando a cota zera.
- **FR-002**: Recursos monitorados: espaço das fotos, gravações de fotos no mês, leituras de fotos no mês, pedidos à IA
  no dia, pedidos à IA no minuto e disco do servidor.
- **FR-003**: Os números das fotos DEVEM vir dos dados de uso da própria conta na nuvem, lidos periodicamente (no
  máximo a cada 1 hora), e ser conferidos com o que o sistema sabe das fotos que gravou; uma diferença maior que 10%
  aparece na tela como aviso.
- **FR-004**: Os pedidos à IA DEVEM ser contados pelo próprio sistema, por dia e por minuto, antes de cada chamada.
- **FR-005**: O sistema DEVE avisar ao passar de 70% (atenção) e de 90% (crítico) de qualquer limite, uma vez por
  mudança de nível, no painel e por e-mail para os Administradores ativos (o e-mail só quando o envio de e-mails
  estiver configurado; sem ele, só o painel).
- **FR-006**: O sistema DEVE recusar fotos novas quando o espaço das fotos ou as gravações do mês atingirem o limite de
  trava, com mensagem clara, sem impedir salvar a notícia como rascunho sem foto. Publicar continua exigindo foto (regra
  editorial existente; decisão de 2026-11-18, opção A).
- **FR-007**: Com a trava das fotos ligada, posts do Instagram DEVEM entrar na fila sem foto, marcados como
  "aguardando espaço", e a foto DEVE ser baixada sozinha quando a trava desligar (se o post ainda existir).
- **FR-008**: Ao atingir o limite de pedidos à IA do dia, a geração de rascunhos DEVE esperar o dia seguinte; no
  limite do minuto, DEVE esperar a vez. Nenhum dos dois casos marca o post como "Erro".
- **FR-009**: As travas DEVEM desligar sozinhas quando o uso voltar para baixo do limite, retomando o que esperava.
- **FR-010**: Na dúvida (leitura falhou ou atrasada), a trava DEVE usar o maior valor conhecido (nuvem ou conta do
  próprio sistema), errando para o lado de travar.
- **FR-011**: Leituras de fotos e disco do servidor DEVEM só avisar, nunca travar.
- **FR-012**: Ligar e desligar uma trava DEVE ir para a auditoria com recurso, uso, limite e motivo.
- **FR-013**: Limites, porcentagens de aviso e de trava, e quais recursos existem DEVEM ser configuráveis sem mudar o
  código; recurso não configurado não aparece.
- **FR-014**: A tela e os avisos DEVEM ser visíveis só para o Administrador; a mensagem de trava ao
  enviar foto aparece para qualquer pessoa que tente enviar.
- **FR-015**: As credenciais usadas para ler os dados de uso da nuvem DEVEM ser só de leitura e ficar fora do código e
  do banco em texto aberto (constituição III).

### Entidades

- **Recurso monitorado**: nome, unidade (bytes, operações, pedidos), limite, porcentagens de aviso e de trava, período
  da cota (minuto, dia, mês, sem período) e se pode travar.
- **Leitura de uso**: recurso, valor, origem (nuvem ou sistema), hora da leitura.
- **Estado da trava**: recurso, ligada ou não, desde quando, último nível de aviso emitido.

## Critérios de sucesso *(obrigatório)*

### Resultados mensuráveis

- **SC-001**: Nenhuma cobrança por uso acima da parte gratuita nos primeiros 6 meses de produção.
- **SC-002**: O Administrador descobre quanto já foi usado de cada recurso em menos de 10 segundos (abrir a tela).
- **SC-003**: Os números das fotos na tela diferem no máximo 10% dos mostrados pela própria nuvem.
- **SC-004**: Em testes simulados, 100% dos envios de foto acima do limite de trava são recusados, e 100% dos rascunhos
  que esbarram no limite da IA são gerados depois sozinhos, sem nenhum post em "Erro" por causa da cota.
- **SC-005**: O aviso de 70% chega com folga: no ritmo médio de uso, pelo menos 1 semana antes da trava das fotos
  (acompanhado na validação e na produção, com o ritmo real registrado).

## Suposições

- Os limites da tabela do Contexto são os planos gratuitos atuais de referência; podem mudar e por isso são
  configuráveis (FR-013).
- A nuvem das fotos oferece dados de uso da conta lidos por uma credencial só de leitura; esses dados podem chegar com
  algum atraso (coberto pelos casos-limite).
- O tráfego para os leitores (saída) é grátis e ilimitado no plano atual, por isso não é monitorado.
- O envio de e-mails (Resend) é outra spec; esta só usa o envio quando ele existir.
- A spec 002 (importação de posts antigos) e a spec 005 (vídeo do Instagram) passam a respeitar as travas desta spec.
- Não faz parte: apagar fotos automaticamente para liberar espaço, nem trocar de plano sozinho; a decisão é sempre de
  uma pessoa.
