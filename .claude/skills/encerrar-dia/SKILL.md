---
name: encerrar-dia
description: Encerra o dia de trabalho no Zona Sul Urgente — atualiza changelog, backlog, specs e documentação, confere testes e segurança e prepara o commit. Use quando o desenvolvedor disser que vai parar, encerrar o dia ou finalizar a sessão.
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
5. **Documentação afetada**: README da raiz, do frontend ou do backend (comandos, variáveis, estrutura), `.env.example`
   (variável nova) e a constituição, se uma regra mudou (com o relatório de sincronização e a versão).
6. **Conferir**, se houve mudança de código, o que o CI roda na parte tocada:
   - frontend: `npm run format:check && npm run lint && npm run typecheck && npm test`
   - backend: `./mvnw verify` (precisa de Docker)
   Se falhar, mostre o erro em vez de seguir.
7. **Conferir segurança**: `git status`; nenhum `.env`/`.env.local`, segredo (`REVALIDATE_SECRET`, `GEMINI_API_KEY`,
   chaves do R2, `TOTP_ENCRYPTION_KEY`), `media-local/` ou dado pessoal real em arquivo versionado.
8. **Resumir** ao desenvolvedor o que entrou no changelog e perguntar se pode commitar. Ao commitar, use
   `docs: atualiza a documentação do dia` (ou prefixo mais adequado), **sem** `Co-Authored-By` nem menção a IA.
