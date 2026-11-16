<!--
Relatório de sincronização
- Versão: (nova) → 1.0.0
- Primeira constituição do Zona Sul Urgente, escrita a partir das regras que o código já segue (READMEs,
  SecurityConfig, services do frontend, application.yml, CI).
- Modelos em .specify/templates/: sem mudança necessária (genéricos do Spec Kit 1.4.1).
-->

# Constituição do Zona Sul Urgente

Portal de notícias da Zona Sul do Rio de Janeiro: site público (Next.js) para o leitor e painel `/admin` para a
redação, sobre uma API Spring Boot com PostgreSQL.

## Princípios

### I. Português em tudo que a pessoa lê

Especificações, planos, tarefas, documentação, textos do site e do painel, mensagens de erro da API e comentários são
em português do Brasil, com acentuação correta. Identificadores de código (variáveis, funções, tabelas, colunas,
rotas da API) ficam em inglês; rotas do site que o leitor vê (`/busca`, `/bairro/...`, `/admin/noticias`) ficam em
português. Datas mostradas seguem o fuso de Brasília.

**Por quê**: leitores e redação leem português; o código segue o padrão das bibliotecas.

### II. A documentação é a fonte oficial

`docs/` descreve como o produto é (backlog, changelog e documentação); `specs/NNN-nome/` descreve cada mudança. Mudança
de comportamento atualiza `docs/` junto com o código (o `plan.md` da spec lista o que muda em `docs/`). O `spec.md` diz
**o quê e por quê**, sem tecnologia; a tecnologia fica no `plan.md`. Decisões em aberto ficam marcadas como em aberto,
não supostas. Os itens do backlog mantêm o código (`FE-1xx`, `BE-0xx`...), que o código cita nos comentários.

**Por quê**: um projeto grande tocado por pouca gente; o que não está escrito se perde.

### III. Segurança e dados pessoais primeiro (INEGOCIÁVEL)

- O navegador nunca fala com a API: o servidor do Next é o BFF. A sessão do painel fica só em cookie httpOnly
  (Secure em produção) e é repassada pelo Next como `Bearer`; o banco guarda só o hash do token. O JavaScript do
  navegador nunca toca em token.
- Login do painel com 2FA (TOTP) obrigatório para quem administra; permissão conferida na API em cada ação
  (`@PreAuthorize`). A matriz do frontend (`config/permissions.ts`) só esconde botões, nunca decide.
- Segurança da API nega por padrão: só `GET /api/v1/public/**` é aberto; `/api/v1/admin/**` exige sessão; o resto é
  negado em `SecurityConfig`.
- Ações do painel gravam auditoria **na mesma transação** da mudança.
- Erros em `problem+json` sem stack trace; documentação interativa da API desligada em produção; portas locais só em
  `127.0.0.1`; segredos só em `.env`, nunca no código nem no `.env.example`.
- Dados de leitores e da equipe (e-mails, telefones) são dados pessoais (LGPD). Scripts de publicidade e medição de
  terceiros só carregam depois do aceite de cookies.

**Por quê**: um portal de notícias é alvo de ataque e de pedido legal; uma falha expõe a redação e os leitores.

### IV. O site funciona sem a API

Sem `API_URL`, o site e o painel rodam com os dados de exemplo (`src/mocks`), e o login fica em modo demonstração.
Componentes e páginas só usam `src/services`, que têm a mesma assinatura nos dois modos; nada lê `src/mocks` direto.
O seed local do banco é gerado dos mocks (`npm run seed:export`), com os mesmos IDs e slugs; não é editado à mão.

**Por quê**: o front evolui sem esperar o back, os testes de ponta a ponta são determinísticos e a demonstração
roda em qualquer lugar.

### V. Contratos explícitos entre site e API

- O schema do banco muda só por migração Flyway nova (`V<n>__nome.sql`), em sequência; migração aplicada não é
  editada. O Hibernate só valida.
- Os records de `shared/contract/` (API) e os tipos de `src/types/` (site) descrevem o mesmo contrato: mudou um,
  muda o outro na mesma mudança.
- As cache tags (`src/lib/cache-tags.ts`) são as mesmas strings que a API manda para `/api/revalidate`.
- Módulos do backend não acessam o repositório de outro domínio; conversam por interfaces e eventos.

**Por quê**: site e API são projetos separados; o contrato é o que impede que um quebre o outro em silêncio.

### VI. O leitor vê a notícia certa, rápido

- Páginas públicas são estáticas e cacheáveis (`use cache` + `cacheTag`); publicar, editar ou despublicar invalida o
  cache pela fila (outbox na transação da mudança) com `expire: 0`: correção editorial ou remoção legal nunca serve
  conteúdo antigo.
- SEO de notícia faz parte da entrega (dados estruturados, sitemaps, RSS, 404 e redirecionamentos reais). Só
  produção é indexada (`NEXT_PUBLIC_SITE_ENV=production`); o painel é sempre `noindex`.
- Layout sem rolagem lateral no celular; imagens com tamanho reservado.

**Por quê**: o portal vive de audiência vinda de busca e redes, quase toda no celular.

### VII. A IA ajuda, a redação decide

A IA editorial só gera **rascunhos** (no máximo um por post de origem) que uma pessoa revisa e publica. Só conteúdo
já público vai para a IA. O provedor real (Gemini) tem reserva configurável e, em desenvolvimento e testes, uma
implementação falsa sem rede.

**Por quê**: responsabilidade editorial e legal é da redação; um texto errado publicado sozinho não tem volta.

### VIII. Pronto é verificado

- Toda regra do backend tem teste de integração com PostgreSQL real (Testcontainers), cobrindo o caminho feliz, a
  recusa por permissão e os casos-limite da spec.
- Regras do frontend (validação, formatação, services) têm teste no Vitest; fluxos do leitor e do painel, no
  Playwright.
- Uma tarefa só é concluída com o que o CI roda verde: `format:check`, `lint`, `typecheck`, `test`, `build`,
  `test:e2e` (frontend) e `./mvnw verify` (backend).

**Por quê**: sem revisão de outra pessoa, o teste é a revisão.

### IX. Simples e na stack combinada

Stack fixa: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4 e shadcn/ui no site; Java 25, Spring
Boot 4, Spring Security, Flyway e PostgreSQL 18 na API; Cloudflare (CDN, WAF, R2) na borda. Dependência nova,
serviço novo ou camada nova só com justificativa no `plan.md` (seção de complexidade). Fila de jobs fica no
próprio PostgreSQL enquanto atender.

**Por quê**: menos peças = menos coisa para manter e para dar errado em produção.

## Restrições do projeto

- **Pastas**: `System-Zona-Sul-Urgente-Web-Frontend/`, `System-Zona-Sul-Urgente-Web-Backend/`, `infra/`, `docs/`,
  `specs/`. `CLAUDE.md` e o resto da `.claude/` (menos `skills/`) não vão para o git.
- **Portas de desenvolvimento**: site 3000, testes de ponta a ponta 3100, API 8080, PostgreSQL 5432.
- **Ambientes**: o perfil `local` da API carrega o seed e chaves de desenvolvimento; nunca é usado em produção. O
  perfil `prod` liga os provedores reais (R2, Gemini) e desliga a documentação da API.
- **Área do desenvolvedor** (`/admin/projeto`): só em `next dev` e só para Administrador; lê `docs/`, `specs/`, esta
  constituição e o `git log` da máquina.

## Fluxo de trabalho

- Spec Kit: `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) →
  `/speckit-implement`. Cada mudança relevante tem sua pasta em `specs/NNN-nome/`, numerada em sequência, e aponta
  os itens do backlog que atende.
- Correção pequena e óbvia (texto, bug de uma linha) não precisa de spec, mas passa pelas mesmas verificações.
- Ao encerrar o dia: `/encerrar-dia` (changelog, backlog e documentação).
- Commits: `<prefixo em inglês>: <descrição em português>`, sem coautor de IA nem "Generated with". Autoria só das
  pessoas do projeto. Commitar só quando o desenvolvedor pedir.

## Governança

Esta constituição vale acima de qualquer outro guia do projeto. Todo `plan.md` confere cada princípio na
"Verificação da constituição"; violação só entra justificada na seção de complexidade. Versão: MAIOR remove ou
redefine princípio; MENOR acrescenta princípio ou seção; CORREÇÃO ajusta texto sem mudar regra.

**Versão**: 1.0.0 | **Ratificada em**: 2026-11-16 | **Última alteração**: 2026-11-16
