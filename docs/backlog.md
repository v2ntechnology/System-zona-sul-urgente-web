# Backlog e plano de desenvolvimento

Reconstruído em 2026-11-16 a partir do código (os IDs citados nos comentários) e do histórico do git, porque o
`doc/BACKLOG.md` original não estava no repositório. Só entram itens com evidência no código; os IDs que faltam na
sequência (ex.: FE-002 a FE-004, BE-001) eram do backlog antigo e devem ser recuperados ou descartados.

Formato que a área do desenvolvedor (`/admin/projeto`) lê: `## <ID> — Título` e, no bloco, `**Status:**` começando por
`Concluído`, `Review`, `Parcial`/`Em andamento` ou `A fazer`/`Proposto`. `**Prioridade:** P0..P3` é opcional.

# FASE 0 — FUNDAÇÃO

## FE-001 — Criar repositório e estrutura inicial
**Status:** Concluído (2026-10-15), exceto a proteção da `main` no GitHub.

## FE-005 — Design tokens e identidade visual
**Status:** Concluído (2026-10-15): tokens em `globals.css`, vitrine em `/admin/design-system`.

## FE-006 — Componentes base do design system
**Status:** Parcial: componentes shadcn em `components/ui/` conforme a necessidade; falta o conjunto completo.

## FE-007 — Header, menu e rodapé do portal
**Status:** Concluído (2026-10-15): header fixo que encolhe, menu lateral, rodapé com editorias e bairros.

## FE-008 — Modelo de domínio (contrato) no frontend
**Status:** Concluído (2026-10-15): `src/types/`.

## FE-009 — Dados de exemplo
**Status:** Concluído (2026-10-15); datas recentes na demonstração com `MOCK_NOW=build` (2026-10-22).

## FE-010 — Camada de services
**Status:** Concluído (2026-10-16): services com a mesma assinatura com e sem `API_URL`.

# CONTRATO

## CT-001 — Contrato REST da API pública
**Status:** Concluído (2026-10-16): records em `shared/contract/`, espelhados em `src/types/`.

## CT-002 — Gerar os tipos do frontend a partir do OpenAPI
**Status:** A fazer: hoje os tipos são escritos à mão.

# PORTAL PÚBLICO

## FE-101 — Home
**Status:** Concluído (2026-10-15): manchete, destaques, últimas, Mais Lidas, blogs e colunas.

## FE-102 — Cards de notícia
**Status:** Concluído (2026-10-15).

## FE-103 — Página da matéria
**Status:** Concluído (2026-10-15).

## FE-104 — Página de editoria
**Status:** Concluído (2026-10-15), com "carregar mais".

## FE-105 — Página de bairro
**Status:** Concluído (2026-10-15), com "carregar mais".

## FE-106 — Busca com filtros
**Status:** Concluído (2026-10-15).

## FE-107 — Mais Lidas
**Status:** Parcial: componente pronto; números reais dependem do BE-015.

## FE-108 — Faixa de urgentes
**Status:** Concluído (2026-10-15).

## FE-109 — Espaços publicitários
**Status:** Concluído (2026-10-15): slot com altura reservada; AdSense só com consentimento (FE-122).

## FE-111 — Chamada para o WhatsApp
**Status:** Concluído (2026-10-15).

## FE-113 — SEO: sitemaps e dados estruturados
**Status:** Concluído (2026-10-15): sitemap geral, sitemap de notícias (48 h), Schema.org, robots.

## FE-114 — Feeds RSS
**Status:** Concluído (2026-10-15): geral e por editoria.

## FE-115 — PWA instalável
**Status:** Concluído (2026-10-15): manifesto, ícones e service worker.

## FE-119 — Web Stories
**Status:** Parcial: AMP pronto; ainda lê os dados de exemplo (falta `GET /api/v1/public/stories`).

## FE-122 — Aviso de cookies (LGPD)
**Prioridade:** P1 (antes de ligar o AdSense) · **Status:** Concluído (2026-11-10).

# PAINEL

## FE-151 — Layout e navegação do painel
**Status:** Concluído (2026-10-15): navbar, barra inferior no celular, itens por permissão.

## FE-152 — Dashboard
**Status:** Parcial: com dados de exemplo.

## FE-153 — Listagem de notícias
**Status:** Concluído (2026-10-16): ligada à API.

## FE-154 — Editor de notícias
**Status:** Concluído (2026-10-16): Tiptap, foto principal, agendamento, ligado à API.

## FE-155 — Fila do Instagram
**Status:** Concluído (2026-11-16): importação manual, conta ligada pela tela (Administrador), posts sincronizados com
foto, avisos de alteração/remoção e de acesso perdido (spec 001).

## FE-156 — Analytics
**Status:** Parcial: telas com dados de exemplo; dados reais dependem do BE-015.

## FE-157 — Publicidade (venda direta)
**Status:** Parcial: campanhas, anunciantes e posições com dados de exemplo; sem backend.

## FE-158 — Editorias e tópicos
**Status:** Concluído (2026-10-16): ligado à API.

## FE-159 — Equipe e autores
**Status:** Concluído (2026-10-16): convites, perfis de autor, primeiro administrador (2026-11-10).

# BACKEND (Spring Boot)

## BE-002 — Erros padronizados e id de requisição
**Status:** Concluído (2026-10-16): RFC 9457 e `X-Request-Id`.

## BE-003 — Schema editorial
**Status:** Concluído (2026-10-16).

## BE-004 — API pública de leitura
**Status:** Concluído (2026-10-16).

## BE-005 — Busca textual
**Status:** Concluído (2026-10-16): texto completo em português, sem acento.

## BE-006 — Login com 2FA
**Status:** Concluído (2026-10-16).

## BE-007 — Permissões (RBAC)
**Status:** Concluído (2026-10-16).

## BE-008 — Auditoria
**Status:** Concluído (2026-11-10).

## BE-009 — CRUD de notícias do painel
**Status:** Concluído (2026-10-16).

## BE-010 — Fila de jobs e publicação dos agendados
**Status:** Concluído (2026-10-16).

## BE-011 — Revalidação do site após publicar
**Status:** Parcial: `/api/revalidate` no Next pronto; falta a purga na Cloudflare.

## BE-012 — Envio de fotos (AVIF e WebP)
**Status:** Concluído (2026-10-16): pasta local ou R2.

## BE-013 — Importação do Instagram
**Status:** Review (2026-11-16): spec 001 implementada — conexão pelo login unificado da Meta (acesso cifrado),
varredura a cada 15 min, mídia guardada, rascunho automático com foto e crédito, legenda alterada/post apagado e avisos.
Validada com a conta reserva (cenários 1–6); faltam os cenários 7–11 (ações na conta) e, em produção, o aviso
instantâneo da Meta (webhook) e o botão "Conectar com Instagram".

## BE-014 — IA editorial
**Status:** Concluído (2026-11-10): Gemini com modelo de reserva e implementação falsa.

## BE-015 — Analytics e contadores de leitura
**Status:** A fazer.

## BE-020 — Editorias com hierarquia e redirecionamentos
**Status:** Concluído (2026-10-16).

## BE-021 — Cidades, zonas e bairros
**Status:** Concluído (2026-10-16).

## BE-023 — Radar de pautas
**Status:** Proposto (2026-11-04).

# QUALIDADE E ENTREGA

## QA-002 — Testes de ponta a ponta
**Status:** Concluído (2026-11-10): Playwright no CI, desktop e celular.

## OPS-001 — Ambiente de staging
**Status:** Parcial: bloqueio de indexação fora de produção pronto; o ambiente ainda não existe.

## OPS-003 — Migração do site antigo
**Status:** Parcial: redirecionamentos de rotas antigas definidos; migração do conteúdo a fazer.
