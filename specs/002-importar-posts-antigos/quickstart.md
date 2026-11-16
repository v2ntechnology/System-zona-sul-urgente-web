# Roteiro de validação: Importar posts antigos do Instagram

## Pré-requisitos

- Spec 001 funcionando: stack local (`docker compose -f infra/compose.yaml --profile app up -d --build postgres api` +
  `npm run dev`), conta reserva ligada (`@zonasulurgentereserva`, 434 posts).
- Login como Administradora (`juliana.prado@zonasulurgente.com.br`) e como Repórter (`ana.ribeiro@…`).
- `AI_PROVIDER=fake` para o lote rápido; `gemini` para ver o ritmo real e o limite.

## Testes automáticos

```bash
cd System-Zona-Sul-Urgente-Web-Backend && ./mvnw verify
cd System-Zona-Sul-Urgente-Web-Frontend && npm test && npm run test:e2e
```

Backend com a Meta falsa (`FakeGraphServer`, ampliada para histórico longo): período, exclusões, sem duplicar,
nenhum rascunho criado, interrupção, falhas (acesso perdido, limite, DEAD), lote no ritmo e com 429 da IA, conferência
em rodízio dos antigos com notícia, permissões.

## Cenários manuais (conta reserva)

| # | Passos | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Repórter abre Instagram | Não vê "Importar posts antigos"; vê o andamento se houver | H1 · FR-001 |
| 2 | Administradora escolhe agosto/2026, abre a lista, desmarca 2 posts, importa | Só os marcados entram, com foto e selo "Antigo"; nenhum rascunho novo em Notícias | H1 · FR-002..005 · SC-002 |
| 3 | Importa "todo o histórico" | Números sobem na tela; os 434 posts entram em < 30 min, sem duplicar os de agosto | H1/H2 · FR-006, FR-007 · SC-001, SC-003 |
| 4 | Durante a 3, clica em Interromper | Para em < 1 min; situação "interrompida"; o que entrou fica | H2 · FR-008 · SC-004 |
| 5 | Durante uma importação, posta algo novo na conta e clica Sincronizar agora | O post novo entra e vira rascunho normalmente | SC-006 |
| 6 | Filtra "Antigos", marca 10 e clica Gerar rascunhos | 10 rascunhos aparecem em ~3 min (4/min), com foto e crédito | H3 · FR-010..012 · SC-005 |
| 7 | Edita no Instagram a legenda de um post antigo que virou notícia | Em até ~1 h fica "Alterado no Instagram" | H1 · FR-014 |
| 8 | Repete a importação de agosto | Nada duplicado; "já estavam na fila" = todos | Casos-limite |

## Conferência final

Auditoria com `INSTAGRAM_HISTORY` (start/cancel/completed) e `AI_BATCH`; nenhum acesso nos logs.
