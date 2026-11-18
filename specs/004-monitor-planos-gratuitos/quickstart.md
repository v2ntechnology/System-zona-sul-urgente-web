# Roteiro de validação: Monitor de uso dos planos gratuitos

## Pré-requisitos

- Local: banco + API em contêiner e site por `npm run dev` (capítulo 11). Sem `CLOUDFLARE_*`, os recursos do R2
  aparecem só com a conta do sistema ("sem leitura da nuvem").
- Produção: token da Cloudflare **só de leitura** ("Account Analytics: Read") em `CLOUDFLARE_ANALYTICS_TOKEN` e o ID
  da conta em `CLOUDFLARE_ACCOUNT_ID` no `infra/.env`; limites da IA em `USAGE_AI_*`.

## Testes automáticos

```bash
cd System-Zona-Sul-Urgente-Web-Backend && ./mvnw verify
cd System-Zona-Sul-Urgente-Web-Frontend && npm test && npm run test:e2e
```

Backend (Cloudflare e Gemini falsos): cálculo do uso (`max` nuvem/sistema + delta), níveis 70/90 uma vez por
mudança, trava e destrava sozinhas, 507 no envio de foto, Instagram sem foto "aguardando espaço" e foto depois,
geração adiada no limite do dia/minuto sem "Erro" e sem gastar tentativa, leitura da nuvem falhando (último valor +
`stale`), permissões (só Administrador), auditoria `USAGE_*`.

## Cenários manuais

| # | Passos | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Administrador abre **Uso dos planos** | Barras de cada recurso com usado/limite/%, hora da leitura e quando zera | H1 · FR-001/002 · SC-002 |
| 2 | Editor procura a tela | Não aparece no menu; `/admin/uso` → não encontrado | FR-014 |
| 3 | Comparar com o painel do R2 na Cloudflare | Diferença ≤ 10% | FR-003 · SC-003 |
| 4 | Baixar o limite de `fotos.espaco` para pouco acima do uso (só no local) e reiniciar | Faixa amarela/vermelha no painel; auditoria `USAGE_LEVEL` | H2 · FR-005 |
| 5 | Com a trava ligada, enviar uma foto no editor | Recusa com "Espaço de fotos esgotado"; a notícia salva sem foto | H3 · FR-006 |
| 6 | Com a trava ligada, sincronizar um post novo do Instagram | Entra "Aguardando espaço"; ao voltar o limite, a foto chega sozinha | FR-007 |
| 7 | Baixar o limite diário da IA para o uso atual e clicar "Gerar agora" | Mensagem com a hora prevista; o post fica "Aguardando a IA", sem "Erro" | FR-008 |
| 8 | Voltar os limites originais | Travas desligam sozinhas, o que esperava anda; auditoria `USAGE_UNLOCK` | FR-009/012 |
