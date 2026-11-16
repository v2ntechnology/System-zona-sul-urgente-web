# Roteiro de validação: Destaques da home

## Pré-requisitos

- Banco + API em contêiner **com** o aviso apontando para o site fora do Docker:
  `SITE_REVALIDATE_URL=http://host.docker.internal:3000 docker compose -f infra/compose.yaml --profile app up -d --build postgres api`
- Site: `npm run dev` (com `REVALIDATE_SECRET` igual ao da API no `.env.local`).
- Contas: `juliana.prado@…` (Administradora), `rafael.duarte@…` (Editor), `ana.ribeiro@…` (Repórter) — senha
  `zonasul-local`.

## Testes automáticos

```bash
cd System-Zona-Sul-Urgente-Web-Backend && ./mvnw verify
cd System-Zona-Sul-Urgente-Web-Frontend && npm test && npm run test:e2e
```

Backend: permissões, só publicadas, patrocinada fora da 1, IDs repetidos, conflito de assinatura, troca atômica,
revalidação enfileirada, atalhos MAIN/HIGHLIGHT/NONE com deslocamento e corte na 10, saída automática ao
despublicar/lixeira com as de baixo subindo, republicar não volta, manchete automática no endpoint público, auditoria.

## Cenários manuais

| # | Passos | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Repórter procura Destaques | Não aparece no menu; `/admin/destaques` → não encontrado | H1 · FR-001 |
| 2 | Editor abre Destaques | Vê as 7 posições da home + 3 de reserva com as notícias atuais | H1 · FR-002 |
| 3 | Põe outra notícia como manchete, reordena, salva | A home (`localhost:3000`) mostra o topo novo em < 1 min, sem recarregar à mão a API | H1 · FR-004, FR-005, FR-012 · SC-002 |
| 4 | Abre Destaques em duas abas, salva numa, depois na outra | A segunda avisa que mudou e mostra a ordem atual | FR-006 |
| 5 | Na listagem, "Colocar como manchete" numa publicada | Vira manchete em 1 clique; as outras descem | H2 · FR-007 · SC-001 |
| 6 | Tenta pôr uma patrocinada na manchete | Opção não aparece; na tela, a posição 1 recusa | FR-010 |
| 7 | Despublica a manchete | Some da home; a de baixo sobe ou entra a automática | H3 · FR-008, FR-009 · SC-003 |
| 8 | Tira a manchete escolhida (posição 1 vazia) | A tela mostra "Manchete automática: <título>" e a home usa a mais recente | FR-009 |

## Conferência final

Auditoria com `HOME_FEATURE` em cada salvamento/atalho; nenhum ajuste no banco à mão.

## Resultado da validação (2026-11-16, ambiente local — API em contêiner, site por `npm run dev`)

Mudanças feitas direto na API (sem passar pelo Next), medindo quando a home do site mudou sozinha:

| # | Resultado |
|---|---|
| 1 | ✅ Repórter → 403 na tela e na API. |
| 2 | ✅ Administradora vê as 10 posições com as notícias atuais. |
| 3 | ✅ Salvar nova manchete → a home mudou sozinha em **2,4 s** (aviso da API chegou ao site fora do Docker — FR-012). |
| 4 | ✅ Assinatura antiga → 409 "Os destaques mudaram". |
| 5 | ✅ Atalho "Colocar como manchete" → home em **2,5 s**. |
| 6 | ✅ Patrocinada como manchete → 422. |
| 7 | ✅ Despublicar a manchete → a de baixo subiu na home em **2,4 s**; republicar não devolveu ao destaque. |
| 8 | ✅ Manchete vazia → a home mostrou a manchete automática (publicada mais recente, não patrocinada). |

A ordem original foi restaurada no fim. Testes automáticos: backend 125 (0 falhas), frontend 124 + 79 de ponta a ponta.
Observação: a notícia "Teste do painel do Zona Sul Urgente", que tinha sido posta na manchete à mão antes desta spec, estava
na lixeira; a V11 a tirou do destaque, como manda a regra nova.
