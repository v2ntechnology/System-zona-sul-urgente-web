# Histórico de alterações

Registro diário do que foi adicionado, alterado e removido no projeto. A entrada mais recente fica no topo. As
entradas até 2026-11-10 foram reconstruídas do histórico do git.

## 2026-11-17

### Adicionado

- **Site novo no ar** em `zonasulurgente.com.br` (e `www`): servidor próprio com a Cloudflare na frente, fotos no
  R2 (`media.zonasulurgente.com.br`) e as 12 editorias e 18 bairros da Zona Sul já cadastrados. Ainda fora do
  Google até a redação publicar as primeiras matérias.
- Primeiro Administrador cadastrado em produção pelo convite.
- Spec 004 (monitor dos planos gratuitos) especificada: uso das fotos, da IA e do disco, com avisos e trava antes de
  passar da cota grátis.

### Alterado

- O site compila mesmo com o banco ainda vazio (sem notícias, stories ou editorias).
- Manual: explica que Stories e Reels repostados de outras páginas não entram sozinhos na fila do Instagram, e que do
  vídeo só a capa vai para a matéria por enquanto.

### Removido

- O site antigo (Vercel) saiu do ar, substituído pelo novo.

## 2026-11-16

### Adicionado

- Configuração de produção para a VPS: banco, API, site e Cloudflare Tunnel num Compose sem portas abertas para a
  internet, script de deploy (o site é compilado com a API no ar) e backup diário do banco, com o roteiro completo na
  documentação técnica.

- Spec Kit (mesma versão dos outros projetos) e a constituição do Zona Sul Urgente, com os princípios que o projeto
  já seguia: português, documentação como fonte oficial, segurança primeiro, site que funciona sem a API, contratos
  entre site e API, leitor primeiro, IA só para rascunhos e verificação pelo CI.
- Documentação versionada em `docs/`: backlog reconstruído do código e este histórico.
- Rotina de encerramento do dia (`/encerrar-dia`).
- Área do desenvolvedor (`/admin/projeto`) com as abas de specs e changelog, lendo `docs/`, `specs/` e a constituição.
- Manual do sistema para o cliente (`docs/documentacao/usuario/`): o que é o portal, o site, acesso e perfis,
  notícias, Instagram e IA, editorias e equipe, dashboard, analytics e publicidade, dúvidas comuns.
- Documentação técnica (`docs/documentacao/tecnico/`): arquitetura, desenvolvimento, variáveis e produção.
- PDFs do manual e da documentação técnica (`uv run scripts/gerar_pdf.py`), atualizados pelo `/encerrar-dia`.
- **Conta do Instagram ligada ao painel** (spec 001): o Administrador liga a conta colando o ID e o acesso da Meta; a
  cada 15 minutos os posts novos entram sozinhos na fila, com a foto (carrossel inteiro ou capa do reel), e viram
  rascunho com foto principal e crédito. A fila avisa quando a legenda muda ou o post é apagado no Instagram, e o
  painel avisa quando o acesso deixa de funcionar ou a sincronização falha seguidamente.
- Spec Kit aplicado de ponta a ponta na spec 001: especificação, plano, tarefas, análise de consistência,
  implementação com testes e validação com a conta reserva.
- Spec 002 (importar posts antigos do Instagram) especificada e planejada: o Administrador escolhe um período e, se
  quiser, desmarca posts numa lista; o histórico entra na fila com foto, sem virar rascunho sozinho; a redação gera
  rascunhos em lote no ritmo da IA. A implementação vem a seguir.
- **Destaques da home** (spec 003): Editor e Administrador escolhem a manchete e os destaques no menu Destaques
  (arrastar ou subir/descer, com prévia) ou pelos atalhos "Colocar como manchete" / "Colocar nos destaques" na lista e
  no editor; a home muda em segundos. Sem manchete escolhida, entra a publicada mais recente; patrocinada nunca vira
  manchete; notícia despublicada ou na lixeira sai do topo sozinha.
- Decisão de hospedagem registrada na documentação técnica: VPS com Docker e a Cloudflare na frente (o Cloudflare
  Workers foi testado e descartado).

### Alterado

- README do backend com os módulos que existem de verdade.
- A área do desenvolvedor passou a ler o backlog e os documentos de `docs/` (versionado) em vez da pasta local
  `doc/`; a aba Histórico virou Commits e a de Documentos inclui os capítulos do manual e da documentação técnica.
- O repositório passa a versionar a documentação, o Spec Kit e as skills do projeto (`CLAUDE.md` continua fora).
- Next.js atualizado para 16.4.6.
- A fila do Instagram deixa claro que post colado à mão espera o "Gerar agora"; só o sincronizado vira rascunho
  sozinho. A tela não oferece mais "urgente publica sozinha" (a IA só faz rascunho).
- A API em contêiner passa a gravar fotos na pasta local (antes falhava por permissão), com volume próprio.
- A home não promove mais a posição 2 a manchete quando a 1 fica vazia: usa a publicada mais recente não patrocinada.
- No ambiente local, a API em contêiner consegue avisar o site que roda fora do Docker (`SITE_REVALIDATE_URL`).

## 2026-11-10

### Adicionado

- IA editorial com Gemini (e modelo de reserva) para gerar rascunhos de notícias, ligada à fila do Instagram.
- Registro de auditoria das ações do painel.
- Aviso de cookies; o AdSense só carrega depois do aceite.
- Testes de ponta a ponta com Playwright, no desktop e no celular.
- Convite do primeiro administrador em servidor novo.
- Mascote do microfone nas páginas de erro.
- Painel do projeto no `/admin` com plano, board, histórico e documentos.

### Alterado

- Ajustes no menu e nas web stories.
- Variável vazia no `.env` não desliga mais o 2FA no ambiente local.

## 2026-10-22

### Adicionado

- Datas recentes nos dados de exemplo da demonstração.

### Alterado

- Correção da rolagem lateral do site e do painel no celular.

## 2026-10-16

### Adicionado

- API: erros padronizados com id de requisição, schema editorial com dados de exemplo locais, leitura pública de
  notícias, login com 2FA e permissões, CRUD de notícias, fila de jobs com publicação automática dos agendados, envio
  de fotos com derivados AVIF e WebP, gestão de editorias, tópicos, equipe e autores.
- Site e painel ligados à API: leitura pública, login, editor e listagem, foto principal, editorias, tópicos, equipe
  e convites.
- Foto do Pão de Açúcar na tela de login.

### Alterado

- Data e hora das matérias agendadas aparecem no painel.
- Foto de endereço não configurado não quebra mais a página.

## 2026-10-15

### Adicionado

- Estrutura do projeto (frontend e backend), design tokens e identidade visual.
- Portal: header, menu lateral, rodapé, faixa de urgentes, home completa, páginas de matéria, editoria e bairro,
  busca com filtros, carregar mais, web stories, robots.txt, sitemaps, feeds RSS e PWA instalável.
- Painel: layout com navbar, dashboard, listagem e editor de notícias, importações do Instagram, analytics,
  publicidade, editorias e tópicos, equipe e autores, tela de login.
- Blogs e colunas na home.

### Alterado

- Editor de notícias e importações do Instagram redesenhados no estilo do Instagram; listagem de notícias em cards.

### Removido

- Compartilhamento duplicado no fim da matéria; sidebar do painel (trocada pela navbar).
