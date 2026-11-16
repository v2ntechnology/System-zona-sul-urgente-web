# Plano de implementação: Destaques da home

**Pasta**: `specs/003-destaques-home` | **Data**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Itens do backlog**: FE-101, FE-153, FE-154, BE-009, BE-011 — implementar antes da spec 002

## Resumo

Uma tela **Destaques** no painel (Editor e Administrador) monta o topo da home: manchete, 2 destaques ao lado, faixa de
4 e 3 de reserva, com busca de publicadas, arrastar ou subir/descer e prévia. Salvar troca a ordem inteira numa
transação (com aviso de conflito) e manda o site atualizar. Atalhos na listagem e no editor fazem o mesmo em um clique.
Despublicar ou mandar para a lixeira tira do destaque e sobe as de baixo. Sem manchete escolhida, a home usa a mais
recente não patrocinada; patrocinada nunca é manchete. O ambiente local passa a avisar o site que roda fora do Docker.
Decisões em [research.md](research.md).

## Contexto técnico

**Linguagem/versão**: Java 25 (API), TypeScript strict / Next.js 16.4.6

**Dependências principais**: módulo `news` (`AdminNewsService`, `AdminNewsRepository`, `NewsReadService`), `site`
(`CacheInvalidateJob`), `audit`. Nenhuma dependência nova no backend nem no frontend (arrastar com HTML5 nativo).

**Armazenamento**: coluna existente `news.featured_rank`; migração `V11__home_featured.sql` (índice único, `CHECK`,
limpeza dos dados, `CHECK` da auditoria) — [data-model.md](data-model.md)

**Testes**: JUnit + Testcontainers; Vitest (service e regra de deslocamento no front); Playwright no modo demonstração

**Plataforma**: local (API em contêiner + site por `npm run dev`) e VPS

**Tipo de projeto**: aplicação web (API + BFF Next)

**Metas de desempenho**: home atualizada < 1 min após salvar (SC-002); atalho em 1 clique (SC-001)

**Restrições**: troca atômica (sem estado intermediário no site); só publicadas; patrocinada fora da posição 1

**Escala**: 10 posições; poucas edições por dia

## Verificação da constituição

| Princípio | Como o plano cumpre | Situação |
|---|---|---|
| I. Português | Tela, mensagens de erro, auditoria e manual em português | ✅ |
| II. Documentação | Manual: capítulo novo/ampliado sobre destaques (`04-noticias.md`) e o fluxo do capítulo 5; técnico: `10-arquitetura.md` e `11-desenvolvimento.md` (modo misto do aviso); backlog e changelog | ✅ |
| III. Segurança | `news.publish` na API (`@PreAuthorize`) e no menu; auditoria `HOME_FEATURE` na mesma transação | ✅ |
| IV. Site sem API | Tela e atalhos funcionam em demonstração (mocks); a home do modo demonstração continua com o topo de exemplo | ✅ |
| V. Contratos explícitos | V11 nova; contrato em [contracts/](contracts/admin-home-featured.md) espelhado em `src/types`; a tag `home` segue o contrato de `cache-tags.ts` | ✅ |
| VI. Leitor primeiro | Correção editorial (despublicar/lixeira) tira da vitrine na hora, com `expire: 0`; a home nunca fica sem manchete | ✅ |
| VII. IA só rascunho | Destaque só aceita publicadas; rascunho da IA nunca entra | ✅ |
| VIII. Verificado | Testes de integração para cada regra (lista no [quickstart](quickstart.md)); CI verde | ✅ |
| IX. Stack combinada | Sem dependência nova; reaproveita coluna, fila e revalidação existentes | ✅ |

Reavaliada após o desenho: sem violações.

## Estrutura do projeto

### Documentação (esta spec)

```text
specs/003-destaques-home/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/admin-home-featured.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Código-fonte

```text
System-Zona-Sul-Urgente-Web-Backend/src/main/
├── resources/db/migration/V11__home_featured.sql                 # novo
└── java/br/com/zonasulurgente/api/
    ├── audit/AuditAction.java                                    # HOME_FEATURE
    └── news/
        ├── admin/HomeFeaturedService.java                        # novo: ler, salvar com assinatura, atalhos
        ├── admin/AdminHomeFeaturedController.java                # novo: GET/PUT /admin/home/featured
        ├── admin/AdminNewsController.java                        # POST /admin/news/{id}/feature
        ├── admin/AdminNewsService.java                           # despublicar/lixeira tiram do destaque
        ├── admin/AdminNewsRepository.java                        # featured_rank: ler, gravar, compactar
        ├── admin/AdminNewsRow.java                               # featuredRank
        └── application/NewsReadService.java                      # manchete automática, sem patrocinada

System-Zona-Sul-Urgente-Web-Backend/src/test/java/br/com/zonasulurgente/api/news/HomeFeaturedApiTests.java  # novo

infra/compose.yaml                                                # SITE_REVALIDATE_URL configurável + extra_hosts

System-Zona-Sul-Urgente-Web-Frontend/src/
├── types/admin.ts · types/news.ts
├── config/admin-navigation.ts                                    # item "Destaques" (news.publish)
├── mocks/admin.ts · services/admin/home-featured-service.ts (+ teste)
├── lib/home-featured.ts (+ teste)                                # regras de deslocamento (atalhos e tela)
├── app/admin/(painel)/destaques/{page.tsx,actions.ts}            # novos
├── app/admin/(painel)/noticias/actions.ts                        # featureNews
└── components/admin/
    ├── home-featured-editor.tsx                                  # novo: posições, busca, arrastar, prévia, salvar
    ├── news-table.tsx                                            # atalhos no menu + selo "Manchete"/"Destaque N"
    └── editor/news-editor.tsx                                    # atalhos para publicada
```

**Decisão de estrutura**: o destaque é parte do módulo `news` (é um atributo da notícia); a tela é uma página nova do
painel.

## Complexidade

Sem violações a justificar.
