---
name: encerrar-dia
description: Encerra o dia de trabalho no Zona Sul Urgente — atualiza changelog, backlog, specs, manual do cliente e documentação técnica, gera os PDFs, confere testes e segurança e prepara o commit. Use quando o desenvolvedor disser que vai parar, encerrar o dia, finalizar a sessão ou pedir para atualizar o PDF da documentação.
---

# Encerrar o dia

Siga em ordem. Escreva tudo em português, com acentuação correta.

1. **Levantar o que mudou no dia**: `git log --since=midnight --format='%h %s'`, `git status` e `git diff --stat`.
   Considere também o que foi feito nesta conversa e ainda não foi commitado.
2. **`docs/changelog.md`**: acrescente (ou complete) a entrada do dia no topo, `## AAAA-MM-DD`, com as subseções
   `### Adicionado`, `### Alterado` e `### Removido` (omita as vazias). Descreva o efeito para quem lê, não o arquivo.
3. **`docs/backlog.md`**: atualize o `**Status:**` dos itens tocados (`Concluído (AAAA-MM-DD): ...`, `Review`,
   `Parcial: ...`, `A fazer`) e acrescente os itens novos com o próximo código livre da área (`FE-0xx` fundação,
   `FE-1xx` portal, `FE-15x+` painel, `BE-`, `CT-`, `QA-`, `OPS-`). Mantenha o formato `## <ID> — Título`, que a área
   do desenvolvedor (`/admin/projeto`) lê.
4. **Spec ativa** (`specs/NNN-*/`): marque em `tasks.md` as tarefas concluídas e registre decisões novas em
   `research.md`. Se a spec terminou, mude a **Situação** do `spec.md`.
5. **Capítulos afetados** — confira no código antes de escrever; nunca descreva como pronto o que ainda é
   demonstração ou só existe na API:
   - `docs/documentacao/usuario/` (vai para o **manual do cliente**, a redação): mudou algo que o leitor vê no site
     ou que a equipe vê ou faz no painel (tela, botão, regra, perfil, permissão, mensagem)? Atualize em linguagem
     simples, sem termos técnicos. Capítulos: visão geral, o site, acesso e perfis, notícias, Instagram e IA,
     editorias e equipe, dashboard/analytics/publicidade, dúvidas.
   - `docs/documentacao/tecnico/` (só **dev**): arquitetura, módulos, fluxo, rotas da API, comandos, testes,
     variáveis de ambiente, produção, decisões.
   - READMEs (raiz, frontend, backend) e `.env.example`: comandos, variáveis ou estrutura mudaram?
   - Constituição (`.specify/memory/constitution.md`): só se uma regra mudou (relatório de sincronização + versão).
   - Capítulo novo = arquivo novo com prefixo numérico na pasta certa (`0x` usuário, `1x` técnico).
6. **Gerar os PDFs**: `uv run scripts/gerar_pdf.py` (na raiz), que gera `docs/pdf/zona-sul-urgente-manual.pdf` e
   `docs/pdf/zona-sul-urgente-documentacao-tecnica.pdf`. Se falhar, mostre o erro.
7. **Conferir**, se houve mudança de código, o que o CI roda na parte tocada:
   - frontend: `npm run format:check && npm run lint && npm run typecheck && npm test`
   - backend: `./mvnw verify` (precisa de Docker)
   Se falhar, mostre o erro em vez de seguir.
8. **Conferir segurança**: `git status`; nenhum `.env`/`.env.local`, segredo (`REVALIDATE_SECRET`, `GEMINI_API_KEY`,
   chaves do R2, `TOTP_ENCRYPTION_KEY`), `media-local/` ou dado pessoal real em arquivo versionado (nem nos PDFs).
9. **Resumir** ao desenvolvedor o que entrou no changelog e nos capítulos e perguntar se pode commitar e enviar. Ao
   commitar, use `docs: atualiza a documentação do dia` (ou prefixo mais adequado), **sem** `Co-Authored-By` nem
   menção a IA.
