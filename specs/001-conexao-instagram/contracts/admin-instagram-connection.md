# Contrato: conexão do Instagram (API do painel)

Base: `/api/v1/admin/instagram`. Chamado só pelo servidor do Next (BFF), com `Authorization: Bearer <sessão>`.
Erros em `application/problem+json` (RFC 9457), títulos em português, com `requestId`.

## `GET /connection` — situação da conexão

Permissão: `instagram.review` (quem vê a fila). Hoje devolve 404; passa a devolver:

- **200** com a conexão:

```json
{
  "username": "zonasulurgentereserva",
  "igUserId": "17841441782026305",
  "status": "ACTIVE",
  "connectedAt": "2026-11-16T18:00:00Z",
  "connectedBy": "Juliana Prado",
  "lastCheckAt": "2026-11-16T18:15:00Z",
  "lastSuccessAt": "2026-11-16T18:15:00Z",
  "pollMinutes": 15,
  "tokenLast4": "x9Qz",
  "tokenExpiresAt": null,
  "tokenDaysLeft": null,
  "alert": null
}
```

- `status`: `ACTIVE` | `REVOKED`.
- `tokenExpiresAt` / `tokenDaysLeft`: `null` quando o acesso não vence.
- `alert`: `null` ou `{ "kind": "REVOKED" | "FAILING" | "EXPIRING", "message": "..." }` — mensagem pronta para a tela,
  em português; `FAILING` só a partir de 3 falhas seguidas.
- **404** quando nenhuma conta está ligada (a tela mostra "Não conectada", como hoje).
- Nunca devolve o acesso.

O campo `publishRule` do tipo atual do frontend **sai** (tudo vira rascunho — constituição VII).

## `PUT /connection` — ligar ou trocar a conta

Permissão: `instagram.settings` (Administrador).

```json
{ "igUserId": "17841441782026305", "accessToken": "EAA…" }
```

- Valida na Meta (`GET /{igUserId}?fields=id,username,name,media_count`) antes de gravar.
- **200** com o mesmo corpo do `GET`. Agenda a primeira varredura (posts dos últimos 7 dias).
- **400** `InvalidFieldsException`: campos vazios; ID não numérico.
- **422** "Não foi possível ligar a conta": a Meta recusou (acesso inválido/revogado, sem permissão, ID errado). A
  mensagem diz o motivo em português; não ecoa o acesso.
- Auditoria `INSTAGRAM_CONNECT` (conta anterior e nova, nunca o acesso).

## `DELETE /connection` — desligar

Permissão: `instagram.settings`. **204**. Para a varredura; posts e notícias continuam. Auditoria
`INSTAGRAM_DISCONNECT`.

## `POST /connection/sync` — sincronizar agora

Permissão: `instagram.settings`. **202** — roda uma varredura fora do ciclo (útil para testar e logo após ligar).
**409** se não houver conta ativa.

## Mudanças em `InstagramPostView` (`GET /posts`)

Campos novos: `source` (`MANUAL` | `API`), `needsPhoto` (boolean), `mediaUrls` (lista das imagens guardadas, na ordem).
`thumbnailUrl` passa a apontar para a foto principal guardada, quando houver.

## Frontend (BFF)

- `src/types/admin.ts`: `InstagramConnection` segue este contrato (sem `publishRule`).
- `src/services/admin/instagram-service.ts`: `getInstagramConnection()` já chama `GET /connection`.
- `app/admin/(painel)/instagram/actions.ts`: novas Server Actions `connectInstagram`, `disconnectInstagram`,
  `syncInstagramNow` (só aparecem para quem tem `instagram.settings`).
- Sem API (modo demonstração): o mock segue o mesmo formato.
