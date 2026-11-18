# Contrato: uso dos planos (painel)

Todas exigem sessão e `settings.manage` (só Administrador). Erros em `problem+json`.

## `GET /api/v1/admin/usage`

```json
{
  "resources": [
    {
      "key": "fotos.espaco",
      "label": "Fotos — espaço",
      "unit": "BYTES",
      "used": 1288490188,
      "limit": 10737418240,
      "percent": 12.0,
      "level": "NORMAL",
      "locked": false,
      "lockAt": 95,
      "source": "cloud",
      "readAt": "2026-11-18T16:30:00Z",
      "stale": false,
      "resetsAt": null,
      "note": null
    }
  ],
  "warnAt": 70,
  "criticalAt": 90,
  "refreshedAt": "2026-11-18T16:30:00Z"
}
```

- `source`: `cloud` (número da Cloudflare) ou `system` (conta do próprio sistema).
- `stale`: a última leitura da nuvem falhou ou tem mais de 2 × `refresh`; a tela mostra "desatualizado".
- `resetsAt`: quando a janela zera (dia/mês/minuto); nulo para espaço e disco.
- `note`: aviso curto (ex.: "Diferença de 14% entre a nuvem e a conta do sistema").

## `POST /api/v1/admin/usage/refresh`

Lê a nuvem agora e devolve o mesmo corpo do `GET`. No máximo 1 por minuto: antes disso, **429** com
`retryAfterSeconds`.

## `GET /api/v1/admin/usage/alerts`

Para o banner do painel. Só os recursos em `WARN`, `CRITICAL` ou travados:

```json
[{ "key": "fotos.espaco", "label": "Fotos — espaço", "percent": 91.5, "level": "CRITICAL", "locked": false }]
```

## Efeitos em rotas existentes

| Rota | Com a trava ligada |
|---|---|
| `POST /api/v1/admin/media` (enviar foto) | **507** `title: "Espaço de fotos esgotado"`, `detail` para a pessoa; nada é gravado |
| `POST /api/v1/admin/instagram/posts/{id}/generate` | **429** `title: "Limite da IA"`, `retryAt`; a geração é enfileirada para essa hora |
| `GET /api/v1/admin/instagram/posts` | cada post ganha `waiting` (`SPACE`/`AI`/nulo) e `waitingUntil` |

## Frontend (BFF)

- `src/services/admin/usage-service.ts`: `getUsage()`, `getUsageAlerts()` (mocks no modo demonstração).
- `app/admin/(painel)/uso/{page.tsx,actions.ts}` (`refreshUsage`).
- Tipos em `src/types/admin.ts`: `UsageResource`, `UsageReport`, `UsageAlert`.
