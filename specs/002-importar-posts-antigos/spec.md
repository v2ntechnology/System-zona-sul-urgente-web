# Especificação: Importar posts antigos do Instagram

**Pasta da spec**: `specs/002-importar-posts-antigos`

**Criada em**: 2026-11-16

**Situação**: Rascunho (esclarecida)

**Itens do backlog**: BE-013 (importação do Instagram), FE-155 (fila do Instagram) — complementa a spec 001

**Pedido**: "Importar posts antigos do Instagram (complementa a spec 001 / BE-013). Hoje, ao ligar a conta, só entram os
posts dos últimos 7 dias, e a varredura só olha os recentes; post antigo só entra colado à mão e sem foto. Queremos que
o Administrador possa trazer posts antigos da conta ligada (inclusive todo o histórico — a conta reserva tem 434 posts;
a oficial terá mais) para a fila do Instagram, com legenda, link, data e foto (mesmas regras de mídia da spec 001:
foto, carrossel inteiro, capa do vídeo). Padrão: os posts antigos entram na fila SEM gerar rascunho automaticamente — a
redação escolhe quais aproveitar clicando em 'Gerar' (para não lotar Notícias de rascunhos velhos nem estourar o limite
da IA no plano grátis). Deve haver como gerar rascunho de vários de uma vez (ex.: selecionar alguns posts antigos e
'Gerar rascunhos'), respeitando o limite da IA (vai gerando aos poucos). Não duplicar posts já na fila (mesma regra do
link). A importação de muitos posts deve rodar em segundo plano, com andamento visível (quantos já entraram) e podendo
ser interrompida. Os posts antigos importados também passam a ser conferidos para legenda alterada/post apagado? Em
aberto: como o Administrador escolhe o que importar (por período de datas, ou vendo uma lista dos posts da conta e
marcando, ou os dois)."

## Esclarecimentos

### Sessão de 2026-11-16

- P: Como o Administrador escolhe o que importar? → R: os dois — período de datas e, opcionalmente, a lista dos posts
  do período para desmarcar antes de confirmar.
- P: Até quando conferir legenda alterada/post apagado nos posts antigos? → R: só os antigos que viraram notícia.

## Contexto

A spec 001 ligou a conta do Instagram ao painel: os posts novos entram sozinhos, com foto, e viram rascunho. Ficou de
fora o **histórico**: ao ligar, entram só os posts dos últimos 7 dias. A conta do jornal tem centenas de posts que
podem virar matérias de arquivo no site novo (boas para busca e para o Google) — mas transformar todos em rascunho de
uma vez lotaria a lista de Notícias com textos velhos e estouraria o limite diário da IA no plano grátis. Por isso a
proposta separa os dois passos: **trazer para a fila** (rápido, sem IA) e **gerar rascunho** só dos que a redação
escolher.

## Cenários de uso e testes *(obrigatório)*

### História 1 — Trazer posts antigos para a fila (Prioridade: P1)

O Administrador escolhe quais posts antigos da conta ligada quer trazer e manda importar. A importação roda em segundo
plano: ele pode sair da tela e voltar. Os posts entram na fila do Instagram com legenda, link, data e foto, marcados
como **antigos**, e **sem** virar rascunho sozinhos.

**Por que esta prioridade**: é o que destrava o histórico; sem isso, cada post antigo exige copiar, colar e subir a
foto à mão.

**Teste independente**: importar um conjunto de posts antigos da conta reserva e ver todos na fila, com foto, marcados
como antigos, e nenhuma notícia nova criada em Notícias.

**Cenários de aceite**:

1. **Dado** uma conta ligada, **quando** o Administrador escolhe um período e manda importar, **então** os posts do
   período entram na fila com legenda, link, data, tipo e foto (foto, todas as do carrossel, capa do vídeo), marcados
   como antigos.
2. **Dado** um período escolhido, **quando** o Administrador abre a lista dos posts do período e desmarca alguns,
   **então** só os marcados entram; a lista mostra quais já estão na fila.
3. **Dado** uma importação de histórico concluída, **quando** alguém abre Notícias, **então** nenhuma notícia nova foi
   criada por ela.
4. **Dado** um post antigo que já está na fila (colado à mão ou trazido antes), **quando** a importação passa por ele,
   **então** ele não é duplicado; se não tinha foto, ganha a foto.
5. **Dado** um post antigo que virou notícia, **quando** a legenda é editada ou o post é apagado no Instagram, **então**
   a fila avisa ("Alterado"/"Removido do Instagram") como na spec 001, mesmo que o post tenha meses.
6. **Dado** um Editor ou Repórter, **quando** abre a tela do Instagram, **então** não vê a opção de importar histórico.

---

### História 2 — Acompanhar e interromper a importação (Prioridade: P1)

Importar centenas de posts leva tempo. Enquanto roda, a tela mostra o andamento (quantos posts já foram lidos, quantos
entraram, quantos já estavam na fila) e o Administrador pode **interromper**. O que já entrou fica.

**Por que esta prioridade**: sem andamento, a importação parece travada; sem interromper, um erro de escolha (período
grande demais) não tem volta.

**Teste independente**: iniciar a importação de todo o histórico da conta reserva, ver os números subirem, interromper
no meio e conferir que os posts já trazidos continuam na fila e nada mais entra.

**Cenários de aceite**:

1. **Dado** uma importação em andamento, **quando** o Administrador abre a tela, **então** vê quantos posts foram lidos,
   quantos entraram e quantos já estavam na fila, e quando começou.
2. **Dado** uma importação em andamento, **quando** o Administrador clica em interromper, **então** a importação para em
   pouco tempo, os posts já trazidos continuam na fila e a situação mostra "interrompida".
3. **Dado** uma importação em andamento, **quando** alguém tenta iniciar outra, **então** o sistema recusa até a atual
   terminar ou ser interrompida.
4. **Dado** que a Meta fica fora do ar ou o acesso é perdido durante a importação, **quando** isso acontece, **então** a
   importação para com a situação "falhou" e o motivo, e o que já entrou fica.

---

### História 3 — Gerar rascunhos de vários posts de uma vez (Prioridade: P2)

Na fila, quem revisa o Instagram marca vários posts (antigos ou não) e clica em **Gerar rascunhos**. O sistema gera aos
poucos, respeitando o limite da IA, e a tela mostra o andamento. Cada post continua virando no máximo uma notícia.

**Por que esta prioridade**: gerar um por um centenas de posts é inviável; mas a importação (H1) já tem valor sem isso.

**Teste independente**: marcar 10 posts antigos, gerar em lote e ver os 10 rascunhos aparecerem em Notícias ao longo
de alguns minutos, sem nenhum duplicado.

**Cenários de aceite**:

1. **Dado** vários posts sem rascunho marcados, **quando** alguém clica em Gerar rascunhos, **então** cada um entra na
   fila de geração e vira rascunho (com foto e crédito, como na spec 001), no ritmo permitido pela IA.
2. **Dado** um lote em geração, **quando** a IA falha num post, **então** esse post fica como "Erro" (com Reprocessar) e
   os outros continuam.
3. **Dado** posts marcados que já viraram notícia ou foram ignorados, **quando** o lote é pedido, **então** eles são
   pulados.
4. **Dado** que a IA atingiu o limite do plano, **quando** isso acontece, **então** a geração espera e continua depois,
   sem perder os posts que faltam.

### Casos-limite

- Histórico muito grande (milhares de posts): a importação vai em partes, sem travar o painel e sem estourar o limite
  de chamadas da Meta.
- Post antigo sem nenhuma imagem disponível (vídeo sem capa): entra com "Precisa de foto", como na spec 001.
- A conta é trocada ou desligada no meio da importação: a importação para (situação "interrompida").
- A varredura normal de 15 minutos continua rodando durante a importação de histórico, sem duplicar nada.
- Posts antigos que parecem publicidade: entram na fila como os outros; a IA sinaliza quando o rascunho for gerado.
- Importar de novo um período já importado: nada é duplicado; só posts que faltavam entram.
- Lista do período muito longa (todo o histórico): a lista carrega aos poucos; quem não quer desmarcar nada confirma
  sem abrir.
- A conferência dos posts antigos que viraram notícia não pode atrasar a varredura dos posts novos.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **FR-001**: Só o Administrador (permissão de configurar o Instagram) pode iniciar e interromper a importação de
  histórico.
- **FR-002**: O Administrador DEVE escolher o que importar por **período de datas** (de/até, ou "todo o histórico") e
  PODE, antes de confirmar, **ver a lista dos posts do período** (miniatura, data, começo da legenda e se já está na
  fila) e **desmarcar** os que não quer. Sem abrir a lista, entram todos os do período.
- **FR-003**: Os posts importados DEVEM entrar na fila com legenda, link, data de publicação, tipo, quantidade de
  mídias e as imagens guardadas no sistema (mesmas regras de mídia da spec 001: foto, todas as do carrossel, capa do
  vídeo; sem imagem → "Precisa de foto").
- **FR-004**: Os posts trazidos pela importação de histórico NÃO DEVEM virar rascunho sozinhos e DEVEM aparecer na fila
  marcados como **antigos**, com a indicação de que o rascunho sai por "Gerar agora" ou pelo lote.
- **FR-005**: A importação NÃO DEVE duplicar posts: a comparação é pelo link, valendo para posts colados à mão,
  sincronizados ou importados antes. Post já na fila sem foto ganha a foto.
- **FR-006**: A importação DEVE rodar em segundo plano e sobreviver ao fechamento da tela; só pode haver uma importação
  de histórico em andamento por vez.
- **FR-007**: A tela DEVE mostrar o andamento da importação atual ou da última: situação (em andamento, concluída,
  interrompida, falhou), posts lidos, posts que entraram, posts que já estavam na fila, início, fim e motivo da falha.
- **FR-008**: O Administrador DEVE poder interromper a importação; a interrupção vale em até 1 minuto e o que já entrou
  fica.
- **FR-009**: Acesso perdido ou falha persistente da Meta DEVEM parar a importação com a situação "falhou" e o motivo
  em português; acesso perdido segue a regra da spec 001 (conexão marcada e aviso no painel).
- **FR-010**: Quem revisa a fila (permissão de revisar o Instagram) DEVE poder marcar vários posts e pedir "Gerar
  rascunhos"; posts que já viraram notícia ou foram ignorados são pulados.
- **FR-011**: A geração em lote DEVE respeitar o limite da IA: no máximo um ritmo configurável de rascunhos por minuto
  (padrão: 4) e, ao bater o limite do plano, esperar e continuar depois.
- **FR-012**: A geração em lote DEVE seguir as regras atuais: só rascunho, no máximo uma notícia por post, só conteúdo
  público vai para a IA, falha vira "Erro" com Reprocessar, com foto principal e crédito quando houver.
- **FR-013**: A fila DEVE permitir filtrar só os posts antigos.
- **FR-014**: Posts antigos que **viraram notícia** DEVEM ser conferidos para legenda alterada e post apagado (mesmas
  regras e avisos da spec 001), qualquer que seja a data do post. Posts antigos sem notícia não são conferidos.
- **FR-015**: Iniciar, interromper e o resultado de cada importação de histórico, e cada lote de geração, DEVEM ir para
  a auditoria (quem, quando, quantos).

### Entidades

- **Importação de histórico**: um pedido do Administrador para trazer posts antigos. O que foi escolhido (período e,
  se usou a lista, os posts desmarcados), quem pediu, situação, contadores (lidos, novos, já existentes), início, fim, motivo da falha.
- **Post do Instagram** (já existe): ganha a marca de **antigo** (veio pela importação de histórico) e referência à
  importação que o trouxe.
- **Lote de geração**: posts marcados para virar rascunho, quem pediu, andamento (gerados, com erro, pulados,
  pendentes).

## Critérios de sucesso *(obrigatório)*

### Resultados mensuráveis

- **SC-001**: Todo o histórico da conta reserva (434 posts) entra na fila em menos de 30 minutos, sem duplicar nenhum.
- **SC-002**: Uma importação de histórico não cria nenhuma notícia em Notícias.
- **SC-003**: O andamento na tela fica no máximo 1 minuto atrás do que já entrou.
- **SC-004**: Interromper para a importação em até 1 minuto.
- **SC-005**: Um lote de 20 posts vira 20 rascunhos (ou erros com Reprocessar) sem intervenção, sem nenhum duplicado.
- **SC-006**: A varredura de 15 minutos continua trazendo os posts novos normalmente durante uma importação de
  histórico.

## Suposições

- A conta está ligada e ativa (spec 001); sem conta ativa, a opção de importar fica indisponível.
- A importação de histórico é feita poucas vezes (na estreia e eventualmente depois); não precisa de agendamento.
- O limite de chamadas da Meta comporta ler o histórico em partes ao longo de alguns minutos.
- O plano grátis da IA tem limite por minuto e por dia; o ritmo padrão do lote (4 por minuto) fica abaixo do limite
  por minuto. O limite diário pode fazer um lote grande continuar no dia seguinte.
- Os rascunhos gerados de posts antigos são iguais aos da spec 001 (mesma foto, crédito e regras); a redação decide se
  publica como matéria de arquivo.
- Stories continuam fora (como na spec 001).
