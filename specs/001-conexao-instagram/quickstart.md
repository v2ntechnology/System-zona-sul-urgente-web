# Roteiro de validação: Conexão com a conta do Instagram

Prova, de ponta a ponta, que a spec 001 funciona. Escrito antes da implementação; cada cenário aponta a história e os
requisitos que cobre.

## Pré-requisitos

- Stack local no ar: `docker compose -f infra/compose.yaml --profile app up -d --build postgres api` e, no frontend,
  `npm run dev` com `API_URL=http://localhost:8080` no `.env.local`.
- App da Meta "Zona Sul Urgente Painel" com a `@zonasulurgentereserva` ligada (feito em 2026-11-16) e o acesso salvo
  em `~/.ig-token-reserva` (fora do projeto). ID da conta: `17841441782026305`.
- Login como Administradora: `juliana.prado@zonasulurgente.com.br` / `zonasul-local` (+ 2FA).
- `AI_PROVIDER=fake` basta para validar o fluxo; `gemini` para ver um rascunho de verdade.

## Testes automáticos (sem rede)

```bash
cd System-Zona-Sul-Urgente-Web-Backend && ./mvnw verify      # inclui os testes novos do Instagram
cd System-Zona-Sul-Urgente-Web-Frontend && npm test && npm run test:e2e
```

Os testes do backend usam um servidor HTTP local no lugar da Meta (mesmo padrão de `GeminiEditorialAiTests`) e
cobrem: ligar com acesso válido/inválido, permissão (`instagram.settings`), varredura com post novo, carrossel, reel
sem `media_url`, deduplicação com post manual, legenda alterada, post apagado, acesso revogado (código 190) e falhas
seguidas.

## Cenários manuais (conta reserva)

| # | Passos | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Painel → Instagram → **Ligar conta**: colar ID e acesso | Mostra `@zonasulurgentereserva`, "ligada agora", "acesso não vence"; auditoria `INSTAGRAM_CONNECT` | H1 · FR-001..004, FR-016, FR-019 |
| 2 | Colar um acesso errado | Não liga; mensagem em português; nada do acesso aparece na tela nem nos logs | H1 · FR-002, FR-003 |
| 3 | Entrar como Repórter (`ana.ribeiro@…`) | Vê a situação; não vê ligar/trocar/desligar | H1 · FR-001 |
| 4 | Logo após ligar (ou **Sincronizar agora**) | Os posts dos últimos 7 dias (hoje: 4 reels) entram na fila, cada um com a capa | H2 · FR-005, FR-006, FR-008 |
| 5 | Aguardar o job | Cada post vira rascunho em Notícias, origem Instagram, com foto principal = capa e crédito "Foto: Reprodução/Instagram @zonasulurgentereserva" | H2 · FR-009, FR-011 · SC-002 |
| 6 | Colar à mão o link de um post que a varredura ainda não trouxe; depois sincronizar | Um único item na fila; ganha a mídia; nenhuma notícia a mais | H2 · FR-007 · SC-003 |
| 7 | Publicar um post de teste na conta reserva | Aparece na fila em até 20 min sem ninguém mexer | H2 · SC-001 |
| 8 | Editar a legenda desse post no Instagram e sincronizar | Fila marca "Alterado no Instagram", com as duas legendas; notícia igual | H3 · FR-012 |
| 9 | Apagar o post no Instagram e sincronizar | Fila marca "Removido do Instagram"; notícia igual | H3 · FR-013 |
| 10 | Revogar o acesso (Configurações do portfólio → Usuários do sistema) e sincronizar | Aviso no painel com a última sincronização boa; auditoria `INSTAGRAM_ACCESS_LOST`; importação manual segue funcionando | H4 · FR-015, FR-017 |
| 11 | Gerar acesso novo e ligar de novo | Aviso some; sincronização volta | H4 · SC-007 |
| 12 | **Desligar** | Tela volta a "Não conectada"; fila e notícias continuam | H1 · FR-001 |

## Conferências finais

- `grep` no log da API e na tabela `audit_logs` pelo início do acesso (`EAA`): nenhuma ocorrência.
- `docs/documentacao/usuario/05-instagram-e-ia.md` e `tecnico/10-arquitetura.md` atualizados; changelog do dia.
