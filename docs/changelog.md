# Histórico de alterações

Registro diário do que foi adicionado, alterado e removido no projeto. A entrada mais recente fica no topo. As
entradas até 2026-11-10 foram reconstruídas do histórico do git.

## 2026-11-16

### Adicionado

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

### Alterado

- README do backend com os módulos que existem de verdade.
- A área do desenvolvedor passou a ler o backlog e os documentos de `docs/` (versionado) em vez da pasta local
  `doc/`; a aba Histórico virou Commits e a de Documentos inclui os capítulos do manual e da documentação técnica.
- O repositório passa a versionar a documentação, o Spec Kit e as skills do projeto (`CLAUDE.md` continua fora).
- Next.js atualizado para 16.4.6.
- A fila do Instagram deixa claro que post colado à mão espera o "Gerar agora"; só o sincronizado vira rascunho
  sozinho. A tela não oferece mais "urgente publica sozinha" (a IA só faz rascunho).
- A API em contêiner passa a gravar fotos na pasta local (antes falhava por permissão), com volume próprio.

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
