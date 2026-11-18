# 6. Editorias, tópicos, equipe e autores

## Editorias

*Editorias* organiza as seções do site (Administrador e Editor).

- **Nova editoria**: nome, endereço (*slug*, ex.: `seguranca`), descrição (aparece no topo da página e no Google)
  e, se quiser, o **canal de WhatsApp** da editoria, que aparece como *Acompanhe no WhatsApp* nas matérias dela.
- **Subeditoria**: escolha uma **editoria mãe** (ex.: *Entretenimento → Gastronomia*). Só há um nível: uma
  subeditoria não pode ter filhas.
- **Aparece na barra do site**: marca as editorias que ficam na barra azul do topo; as outras ficam no menu e no
  rodapé. A ordem pode ser mudada.
- **Desativar / Reativar**: tira a editoria do site sem apagar as matérias.
- Alguns endereços são reservados ao site (ex.: `busca`, `bairro`, `admin`) e não podem virar editoria.
- Se o endereço de uma editoria mudar, o endereço antigo continua funcionando e redireciona para o novo.

## Tópicos

Tópicos são as `#hashtags` das matérias. Em *Editorias → Tópicos* (Administrador, Editor e Repórter) dá para
**buscar**, **renomear**, **desativar/reativar** e **juntar tópicos** repetidos (ex.: `#transito` e `#trânsito`):
escolha os tópicos, diga qual nome fica, e as matérias passam a usar só ele.

## Equipe (acessos)

Só o Administrador vê esta aba.

- **Convidar pessoa**: nome, e-mail e perfil. O sistema gera o **link do convite** (copie e envie); a pessoa cria a
  senha ao abrir. Dá para marcar **Criar o perfil de autor junto**, para ela já assinar matérias.
- **Trocar perfil**, **desativar acesso**, **cancelar convite** e **zerar a verificação em duas etapas** de quem
  perdeu o celular.
- Ninguém pode alterar o próprio acesso, para o sistema nunca ficar sem Administrador por engano.

## Autores

*Equipe → Autores* (Administrador e Editor) cuida de **quem assina** as matérias, com ou sem login no painel:
nome na assinatura, cargo (Redação, Repórter, Colunista, Colaborador, Fotógrafo, Agência), minibio e Instagram.
**Novo autor sem login** serve para colaboradores e agências que não usam o painel. Autores podem ser desativados
e reativados.

## Uso dos planos gratuitos (Administrador)

O site usa serviços com **cota grátis**: o espaço das fotos, as gravações e leituras de fotos do mês e os pedidos à
IA que escreve os rascunhos. Passar da cota geraria cobrança — por isso o painel acompanha e **trava antes**.

No menu da sua conta (no celular, em **Mais**), abra **Uso dos planos**. Cada cartão mostra quanto já foi usado, o
limite grátis, a porcentagem, de onde veio o número (Cloudflare ou a conta do próprio sistema), a hora da leitura e
quando a cota zera. **Atualizar agora** lê os números na hora (no máximo uma vez por minuto).

| Situação | O que significa | O que fazer |
|---|---|---|
| Barra **amarela** (70%) | Atenção: o uso está crescendo | Acompanhe; evite importações grandes |
| Barra **vermelha** (90%) | Crítico: perto da trava | Avalie apagar fotos antigas ou mudar de plano |
| **Travado** | O sistema parou de gastar esse recurso | Espere a cota zerar ou libere espaço |
| **Sem limite configurado** | Falta informar o limite da IA | Peça ao suporte técnico para configurar |
| **Desatualizado** | A última leitura da Cloudflare falhou | O número mostrado é o último lido; tente de novo depois |

Quando algum recurso passa de 70%, uma faixa aparece no topo do painel para quem é Administrador. (Quando o envio de
e-mails estiver ligado, o aviso também chega por e-mail.)

O que cada trava faz:

- **Fotos (espaço ou gravações do mês)**: a foto nova é recusada com a mensagem *"Espaço de fotos esgotado"*; a notícia
  pode ser salva como rascunho sem a foto. Posts do Instagram entram na fila **"Aguardando espaço"** e a foto chega
  sozinha quando a trava desliga.
- **IA**: o rascunho espera, com o selo **"Aguardando a IA · volta às HH:MM"**, e sai sozinho quando a cota volta —
  nunca vira "Erro".
- **Leituras de fotos e disco do servidor** só avisam: as fotos nunca saem do ar.

