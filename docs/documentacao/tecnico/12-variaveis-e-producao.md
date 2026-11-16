# 12. Variáveis de ambiente e produção

## Site (`System-Zona-Sul-Urgente-Web-Frontend/.env.local`)

| Variável | Para que serve |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública (canonical, OpenGraph, sitemap). |
| `API_URL` | URL da API, só no servidor. Vazio = dados de exemplo e painel em demonstração. Com ela, o **build** busca dados na API (precisa estar no ar). |
| `REVALIDATE_SECRET` | Segredo do `POST /api/revalidate` (mín. 32 caracteres, `openssl rand -base64 32`). Vazio = revalidação desligada (503). |
| `NEXT_PUBLIC_SITE_ENV` | `production` libera a indexação. Qualquer outro valor bloqueia (robots e meta). **Sem ela em produção o site some do Google.** |
| `ADMIN_PREVIEW` | `true` abre o painel em demonstração sem API (só ambiente protegido). Lido no build. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | ID do AdSense (`ca-pub-...`). Vazio = desligado. Só carrega após o aceite de cookies. |
| `NEXT_PUBLIC_WHATSAPP_URL` · `NEXT_PUBLIC_REPORT_WHATSAPP_URL` | Canal do jornal · WhatsApp da redação ("Envie sua notícia"). |
| `MOCK_NOW` | Só na demonstração: `build` usa a data do build como "agora". Vazio = 2026-10-15. |

## API (`System-Zona-Sul-Urgente-Web-Backend/.env`)

| Variável | Para que serve |
|---|---|
| `DB_URL` · `DB_USER` · `DB_PASSWORD` · `PORT` | Banco e porta. |
| `SPRING_PROFILES_ACTIVE` | `local` (dev, com seed) ou `prod`. |
| `TOTP_ENCRYPTION_KEY` | AES-256 em base64 dos segredos do 2FA. Trocar invalida os 2FA cadastrados. |
| `SITE_REVALIDATE_URL` · `REVALIDATE_SECRET` | URL interna do Next e o mesmo segredo do site. Vazios = revalidação desligada. |
| `MEDIA_STORAGE` · `MEDIA_PUBLIC_URL` · `MEDIA_S3_*` | `local` (pasta `media-local/` em `/media/**`) ou `s3` (R2, `https://media.<domínio>`). |
| `AI_PROVIDER` · `GEMINI_API_KEY` · `GEMINI_MODEL` · `GEMINI_FALLBACK_MODEL` | IA editorial (`fake` ou `gemini`) e modelo de reserva. |
| `ZSU_BOOTSTRAP_ADMIN_EMAIL` · `ZSU_BOOTSTRAP_ADMIN_NAME` · `ZSU_SITE_URL` | Primeiro administrador num banco sem Admin ativo: a API cria o convite e mostra o link no log. |

## Produção

- API com `SPRING_PROFILES_ACTIVE=prod`: fotos no R2, Gemini obrigatório, Swagger desligado.
- Site com `NEXT_PUBLIC_SITE_ENV=production` e `API_URL` (o painel só existe com login de verdade).
- Health: site `GET /api/health`; API `GET /actuator/health`.
- Servidor novo: defina `ZSU_BOOTSTRAP_ADMIN_EMAIL` e `ZSU_SITE_URL`, suba a API e pegue o link do convite no log
  (7 dias, uso único).
- Portas expostas só em `127.0.0.1`; a borda é a Cloudflare.
- Staging: qualquer `NEXT_PUBLIC_SITE_ENV` diferente de `production` bloqueia a indexação; o painel em demonstração
  (`ADMIN_PREVIEW=true`) só atrás de proteção (ex.: Cloudflare Access).

## Decisão de hospedagem (2026-11-16)

- **Escolhido:** VPS com Docker Compose (site Next + API + PostgreSQL) e a Cloudflare na frente (DNS, CDN, WAF, R2),
  de preferência com Cloudflare Tunnel (sem portas abertas na VPS). Imagens compiladas no GitHub Actions; a VPS só
  baixa e reinicia. Mínimo: 4 GB de RAM.
- **Descartado: Cloudflare Workers (OpenNext).** Testado localmente com `@opennextjs/cloudflare` 1.20.17 (exige Next
  ≥ 16.4.5): as rotas com `ensureStatic = "navigation"` (`[...path]` e `bairro/[slug]`) travam no runtime do Workers e
  respondem 500 quando a página não foi gerada no build — 404/308 de verdade e matérias publicadas depois do deploy
  quebrariam. Tirar o `ensureStatic` faz funcionar, mas o 404 vira "200 + noindex" (contra a constituição VI). Além
  disso, a API Java precisa de servidor de qualquer forma.
- **Domínio:** `.com.br` no Registro.br (revendedor Newfold/HostGator), sem DNSSEC; DNS hoje na Vercel
  (`ns1/ns2.vercel-dns.com`), com registro curinga `*` apontando para a Vercel e sem e-mail no domínio. A ida para a
  Cloudflare é troca de servidores de DNS no painel da HostGator (`.com.br` não transfere para o registrador da
  Cloudflare); copiar antes os registros, inclusive os CAA.
