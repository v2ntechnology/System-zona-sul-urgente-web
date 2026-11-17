# 5. Instagram e inteligência artificial

## Para que serve

Boa parte das notícias do Zona Sul Urgente começa como post no Instagram. A tela **Instagram** transforma esses
posts em **rascunhos de matéria**, escritos por inteligência artificial a partir da legenda e já com a foto do post,
para a redação revisar e publicar. Ela aparece para Administrador, Editor e Repórter.

## Do Instagram ao site: o caminho de uma notícia

| Etapa | Quem faz | O que acontece |
|---|---|---|
| 1. Post no Instagram | Redação, no Instagram | O painel traz o post para a fila em até 15 minutos, com a foto. |
| 2. Rascunho | O sistema (IA) | A IA escreve o rascunho em *Notícias*. **Nada vai ao ar.** |
| 3. Conferência | Qualquer pessoa da redação | Abrir o rascunho e conferir texto, título, foto, texto alternativo, crédito, editoria, bairro e a marca de urgente. |
| 4. Publicação | Editor ou Administrador | Clicar em *Publicar*. Repórter, Comercial e Autor usam *Enviar para revisão*. |
| 5. Destaque (opcional) | Editor ou Administrador | Colocar a notícia publicada na manchete ou nos destaques da home (menu **Destaques** ou atalho na lista — capítulo 4). |

A IA **nunca publica nem destaca**: as etapas 3, 4 e 5 são sempre de uma pessoa. Atenção na conferência à marca de
**urgente** sugerida pela IA — ela põe a notícia na faixa vermelha do site.

## Ligar a conta do Instagram (Administrador)

Com a conta ligada, o painel confere o Instagram **a cada 15 minutos** e traz os posts novos sozinho. Só o
Administrador liga, troca ou desliga a conta; os outros perfis veem se ela está ligada.

1. No painel de desenvolvedor da Meta (o app do painel do Zona Sul Urgente), copie o **ID da conta** — os números que
   aparecem ao lado do nome da conta — e gere o **acesso** pelo botão *Gerar token*.
2. No painel, em **Instagram → Conta do Instagram**, cole o ID e o acesso e clique em **Ligar conta**.
3. O sistema confere na Meta antes de guardar. Deu certo: aparecem o nome da conta, quem ligou, os últimos números do
   acesso e "não vence". Na hora, ele já traz os posts dos **últimos 7 dias**.

O acesso fica guardado de forma protegida e **não aparece de novo** na tela. Para trocar de conta (por exemplo, da
conta de testes para a oficial) ou de acesso, use **Trocar conta ou acesso**; os posts e as notícias que já existem
continuam. **Desligar** para a sincronização, sem apagar nada. **Sincronizar agora** busca os posts novos sem esperar
os 15 minutos.

## Como os posts entram na fila

- **Sozinhos, com a conta ligada**: cada post novo entra com a legenda, o link, a data e a **foto** (no carrossel,
  todas as fotos; no vídeo ou reel, a capa). A IA escreve o rascunho em instantes, e ele aparece em *Notícias* como
  **Rascunho**, com origem *Instagram*, a foto principal e o crédito *Foto: Reprodução/Instagram @conta*.
- **À mão, a qualquer momento**: em **Adicionar post do Instagram**, cole o **link do post**
  (`https://www.instagram.com/p/...`) e a **legenda** e confirme. O post entra na fila e o rascunho sai quando alguém
  clica em **Gerar agora**. Se depois a sincronização encontrar o mesmo post, ele não é duplicado: só ganha a foto.

Do vídeo ou Reels, por enquanto só a **capa** vai para a matéria (o vídeo dentro da matéria é o próximo passo).
Stories e Reels repostados de outras páginas não entram sozinhos (veja *Dúvidas*).

Em todos os casos, abra o rascunho, revise texto, título, foto, texto alternativo da foto, editoria e bairro, e
publique (ou envie para revisão).

## A fila

| Situação | O que significa | O que fazer |
|---|---|---|
| Novo | Entrou na fila. Se veio da conta ligada, a IA já está escrevendo o rascunho. | Aguardar, ou clicar em *Gerar agora* (post colado à mão). |
| Importado | O rascunho já foi criado. | Abrir a notícia e revisar. |
| Alterado no Instagram | A legenda mudou depois da importação. | *Comparar com a notícia* e decidir se corrige; depois *Marcar como revisado*. |
| Removido do Instagram | O post saiu do Instagram. | Avaliar se a matéria continua no ar. |
| Erro | A IA não conseguiu gerar. | *Reprocessar*. |
| Ignorado | Alguém decidiu não aproveitar o post. | Pode voltar para a fila. |

O selo **Precisa de foto** aparece quando o Instagram não entregou nenhuma imagem do post (acontece com alguns vídeos):
escolha a foto principal no editor antes de publicar.

A fila confere os posts dos **últimos 30 dias**: se a legenda mudar ou o post for apagado no Instagram, ela avisa.
A notícia **nunca muda sozinha** — quem decide é a redação.

## Avisos da conta

- **Acesso perdido** (vermelho): o acesso foi revogado ou removido no painel da Meta. A sincronização para até o
  Administrador gerar um acesso novo e ligar a conta de novo. Enquanto isso, os posts podem ser adicionados à mão.
- **Sincronização falhando** (amarelo): a Meta não respondeu em 3 tentativas seguidas (cerca de 45 minutos). O
  sistema continua tentando e o aviso some sozinho quando ela voltar.

## Regras da IA

- A IA **só escreve rascunhos**. Ela nunca publica nem escolhe destaque. Ela pode sugerir editoria, bairro,
  tópicos e a marca de urgente, mas só o que o perfil de quem gerou pode usar (na sincronização, as permissões de
  Repórter); tudo é revisado antes de publicar.
- Posts que parecem publicidade são sinalizados pela IA; o rascunho é criado assim mesmo e a redação decide.
- Cada post gera **no máximo uma** matéria.
- A legenda original fica guardada como foi importada, para conferência.
- Só conteúdo que já é público (o post do Instagram) é enviado para a IA.
- Se o serviço de IA estiver fora do ar, o sistema tenta um modelo reserva; se ainda assim falhar, o post fica em
  *Erro* e pode ser reprocessado depois.
