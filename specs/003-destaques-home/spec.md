# Especificação: Destaques da home (curadoria editorial)

**Pasta da spec**: `specs/003-destaques-home`

**Criada em**: 2026-11-16

**Situação**: Concluída (2026-11-16)

**Ordem**: implementar **antes** da spec 002 (pedido do desenvolvedor em 2026-11-16)

**Itens do backlog**: FE-101 (home), FE-153/FE-154 (listagem e editor do painel), BE-009 (notícias do painel), BE-011
(revalidação do site)

**Pedido**: "Destaques da home (curadoria editorial) — vem antes da spec 002. Hoje a manchete e os destaques da home do
site vêm de um campo de posição no destaque (1 = manchete, 2 e 3 = destaques ao lado, 4 a 7 = faixa logo abaixo,
completada pelas últimas notícias; a API aceita até 10), mas o painel não tem nenhuma tela para escolher isso — só dá
para mudar direto no banco. Queremos que Editor e Administrador escolham, no painel, qual notícia publicada é a
manchete e quais são os destaques, reordenem (arrastar ou subir/descer), troquem e tirem do destaque, vendo uma prévia
de como fica a home; e que o site atualize em instantes depois de salvar (como já acontece ao publicar). Também dar um
atalho no editor/listagem de notícias: 'Colocar como manchete' / 'Colocar nos destaques'. Regras: só notícia
publicada pode estar no destaque; ao despublicar ou mandar para a lixeira uma notícia destacada, ela sai do destaque
sozinha e as outras sobem; Repórter, Comercial e Autor não mexem no destaque; tudo vai para a auditoria. Problema
encontrado no teste local: quando o site roda fora do Docker e a API dentro, o aviso de atualização da API não chega ao
site (o endereço é o interno do Docker); resolver para o ambiente local poder testar 'salvei → a home mudou'. Em
aberto: se a manchete pode ficar vazia (a home usa a notícia mais recente) e se uma notícia patrocinada pode ser
manchete."

## Esclarecimentos

### Sessão de 2026-11-16

- P: A manchete pode ficar vazia? → R: pode — a home usa a mais recente (manchete automática) —, mas o Editor pode
  trocar por uma escolhida quando precisar.
- P: Notícia patrocinada no topo? → R: só nos destaques, nunca na manchete.

## Contexto

### O caminho de uma notícia vinda do Instagram

1. **Post no Instagram** → a sincronização (spec 001) traz o post para a fila, com foto.
2. **Rascunho** → a IA escreve o rascunho em Notícias. Nada vai ao ar nesta etapa.
3. **Conferência** → uma pessoa da redação abre o rascunho e confere texto, título, foto, texto alternativo, crédito,
   editoria, bairro e a marca de urgente.
4. **Publicação** → só Editor ou Administrador publica (Repórter, Comercial e Autor enviam para revisão).
5. **Destaque (esta spec)** → depois de publicada, a notícia pode ir para a manchete ou os destaques da home.

A IA nunca publica nem destaca. Esta spec cuida só da etapa 5: escolher o que, entre o que **já foi conferido e
publicado**, abre a home.

O topo da home é a vitrine do jornal: a **manchete** (foto grande), **2 destaques** ao lado e uma **faixa de 4**
logo abaixo. Quem decide o que vai ali é a redação — é a escolha editorial mais importante do dia. O site já mostra o
topo pela ordem de destaque, mas no painel não existe tela para escolher: no teste de 2026-11-16, uma notícia
publicada só virou manchete com um ajuste direto no banco.

## Cenários de uso e testes *(obrigatório)*

### História 1 — Montar o topo da home no painel (Prioridade: P1)

Editor ou Administrador abre **Destaques da home** no painel e vê as posições do topo (manchete, 2 destaques ao lado,
faixa de 4) com as notícias que estão em cada uma. Busca uma notícia publicada e põe numa posição, reordena (arrastando
ou com subir/descer), troca ou tira do destaque, vê a prévia de como fica e salva. Em instantes, a home do site mostra
o topo novo.

**Por que esta prioridade**: sem isso, a redação não controla o que abre o site.

**Teste independente**: escolher uma notícia publicada como manchete, salvar e ver a home do site mudar em menos de
1 minuto.

**Cenários de aceite**:

1. **Dado** o topo atual, **quando** o Editor abre Destaques da home, **então** vê cada posição com a notícia que está
   nela (título, foto, editoria, quando foi publicada) e as posições vazias.
2. **Dado** a tela de destaques, **quando** o Editor busca uma notícia publicada e põe como manchete, **então** a prévia
   mostra a nova manchete e a anterior desce uma posição (ou vai para onde ele escolher).
3. **Dado** mudanças na tela, **quando** o Editor salva, **então** a home do site mostra o topo novo em menos de
   1 minuto, e a mudança vai para a auditoria (quem, quando, antes e depois).
4. **Dado** mudanças não salvas, **quando** o Editor sai da tela, **então** é avisado de que vai perder as mudanças.
5. **Dado** um Repórter, Comercial ou Autor, **quando** procura a tela de destaques, **então** ela não aparece no menu e o
   acesso direto é recusado.

---

### História 2 — Atalho a partir da notícia (Prioridade: P2)

Na listagem de notícias e no editor de uma notícia publicada, o Editor tem **Colocar como manchete** e **Colocar nos
destaques** (e **Tirar do destaque**, se ela já estiver lá), sem precisar abrir a tela de destaques.

**Por que esta prioridade**: o caso mais comum — "acabei de publicar e quero na manchete" — fica em um clique; mas a
tela da H1 já resolve sozinha.

**Teste independente**: publicar uma notícia, clicar em Colocar como manchete na listagem e ver a home mudar.

**Cenários de aceite**:

1. **Dado** uma notícia publicada fora do destaque, **quando** o Editor clica em Colocar como manchete, **então** ela vira
   a manchete e as outras descem uma posição; a última, se passar do limite, sai do destaque.
2. **Dado** uma notícia publicada, **quando** o Editor clica em Colocar nos destaques, **então** ela entra na posição 2
   (primeiro destaque depois da manchete) e as seguintes descem — mesmo com a manchete automática (posição 1 vazia), que
   continua automática.
3. **Dado** uma notícia destacada, **quando** o Editor clica em Tirar do destaque, **então** ela sai e as de baixo sobem.
4. **Dado** uma notícia patrocinada publicada, **quando** o Editor abre o menu dela, **então** vê Colocar nos destaques,
   mas não Colocar como manchete.
5. **Dado** uma notícia em rascunho, agendada ou despublicada, **quando** o Editor abre o menu dela, **então** os atalhos
   de destaque não aparecem.

---

### História 3 — O destaque se ajusta sozinho (Prioridade: P1)

Notícia que deixa de estar no ar (despublicada ou na lixeira) sai do destaque sozinha, e as de baixo sobem —
o topo da home nunca mostra notícia que não está publicada.

**Por que esta prioridade**: uma remoção editorial ou legal não pode deixar a notícia na vitrine.

**Teste independente**: despublicar a manchete e ver a home mostrar a próxima como manchete.

**Cenários de aceite**:

1. **Dado** uma notícia destacada, **quando** ela é despublicada ou vai para a lixeira, **então** ela sai do destaque, as
   de baixo sobem e a home atualiza em menos de 1 minuto.
2. **Dado** que a manchete sai do ar e a notícia da posição 2 é patrocinada, **quando** as de baixo sobem, **então** a
   patrocinada **não** vira manchete: a posição 1 fica com a manchete automática e as posições de 2 em diante sobem.
3. **Dado** que a manchete saiu do ar e nenhuma notícia escolhida sobe para o lugar, **quando** alguém abre a home,
   **então** a manchete é a notícia publicada mais recente (que não seja patrocinada), e a tela de destaques mostra
   "Manchete automática".
4. **Dado** uma notícia que saiu do destaque desse jeito, **quando** ela é publicada de novo, **então** ela não volta
   sozinha para o destaque.

### Casos-limite

- Duas pessoas editando o topo ao mesmo tempo: quem salva por último é avisado de que o topo mudou e vê a versão nova
  antes de salvar por cima.
- Notícia publicada há muitos dias: pode ser destacada; a tela mostra há quanto tempo foi publicada.
- Mais notícias destacadas do que posições: ao colocar uma nova, a última sai do destaque (a tela avisa qual).
- Notícia urgente: pode estar no destaque; a faixa de urgentes continua independente.
- Aviso de mudanças não salvas: vale para fechar ou recarregar a aba e para os links do próprio painel; o botão
  "voltar" do navegador pode sair sem aviso (limitação aceita).
- Ambiente local com o site fora do Docker e a API dentro: o aviso de atualização precisa chegar ao site (ver FR-012).

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **FR-001**: Só Editor e Administrador (quem pode publicar notícias) DEVEM ver e mudar os destaques da home; os
  demais perfis não veem a tela nem os atalhos, e a API recusa a mudança.
- **FR-002**: A tela DEVE mostrar as posições do topo como o site usa: 1 = manchete, 2 e 3 = destaques ao lado, 4 a 7 =
  faixa logo abaixo; até 10 posições no total (as de 8 a 10 ficam guardadas como reserva, sem aparecer na home atual).
- **FR-003**: Só notícias **publicadas** PODEM entrar no destaque — ou seja, já conferidas e publicadas por uma pessoa;
  rascunhos (inclusive os gerados pela IA a partir do Instagram) nunca entram. A busca da tela só oferece publicadas.
- **FR-004**: O Editor DEVE poder pôr, trocar, reordenar (arrastar e subir/descer) e tirar notícias das posições, e ver
  uma prévia do topo antes de salvar; nada muda no site até salvar.
- **FR-005**: Salvar DEVE gravar a ordem inteira de uma vez (sem estado intermediário no site) e atualizar a home em
  menos de 1 minuto.
- **FR-006**: Se o topo foi mudado por outra pessoa depois que a tela foi aberta, salvar DEVE avisar e mostrar a versão
  atual em vez de sobrescrever sem aviso.
- **FR-007**: A listagem e o editor de notícias DEVEM oferecer, para notícias publicadas, Colocar como manchete,
  Colocar nos destaques e Tirar do destaque, com as regras de deslocamento das Histórias 2.
- **FR-008**: Notícia despublicada ou enviada para a lixeira DEVE sair do destaque na mesma operação, e as de baixo
  DEVEM subir — exceto que uma patrocinada nunca sobe para a manchete (a posição 1 fica automática); publicar de novo não
  a devolve ao destaque. O painel ainda não tem a ação "arquivar"; quando tiver, segue esta mesma regra.
- **FR-009**: A manchete PODE ficar vazia: nesse caso a home usa a notícia publicada mais recente (manchete
  **automática**), e a tela mostra isso ("Manchete automática: a mais recente") com a notícia que está aparecendo. A
  qualquer momento o Editor PODE trocar a automática por uma manchete escolhida, e voltar para a automática tirando a
  escolhida.
- **FR-010**: Notícias patrocinadas PODEM ocupar as posições de destaque (2 a 10), sempre com o selo Patrocinado,
  mas NUNCA a manchete (posição 1): a tela e os atalhos não oferecem "Colocar como manchete" para elas, a API recusa,
  e a manchete automática pula as patrocinadas.
- **FR-011**: Cada salvamento e cada atalho DEVEM ir para a auditoria com quem, quando e a ordem antes e depois.
- **FR-012**: No ambiente local, com o site fora dos contêineres e a API dentro, o aviso de atualização da API DEVE
  chegar ao site, para que "salvei → a home mudou" possa ser testado sem passo manual.

### Entidades

- **Destaque da home**: a ordem das notícias no topo — posição (1 a 10) e notícia. Uma notícia ocupa no máximo uma
  posição; cada posição tem no máximo uma notícia.
- **Notícia** (existente): ganha a informação de estar ou não no destaque e em qual posição (já existe no sistema, sem
  tela).

## Critérios de sucesso *(obrigatório)*

### Resultados mensuráveis

- **SC-001**: Trocar a manchete leva menos de 30 segundos no painel (pelo atalho, 1 clique).
- **SC-002**: Depois de salvar, a home do site mostra o topo novo em menos de 1 minuto.
- **SC-003**: Em 100% dos casos, notícia despublicada ou na lixeira deixa de aparecer no topo da home em menos de
  1 minuto.
- **SC-004**: Nenhuma mudança no topo fica sem registro na auditoria.
- **SC-005**: Nenhum ajuste direto no banco é necessário para montar o topo da home.

## Suposições

- A "permissão de publicar" (Editor e Administrador) é a mesma que decide o destaque; não é preciso uma permissão nova.
- A home continua com o mesmo desenho (manchete, 2 ao lado, faixa de 4); se o desenho mudar, as posições acompanham.
- Destaques por editoria (topo da página de cada editoria) ficam fora desta spec.
- Agendar a troca da manchete para um horário fica fora desta spec.
- Os dados de exemplo (modo sem API) continuam com o topo atual, e a tela funciona em modo demonstração.
