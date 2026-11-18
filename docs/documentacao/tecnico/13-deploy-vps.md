# 13. Deploy na VPS

Produção numa VPS (Hostinger KVM 2: 2 vCPU, 8 GB, Ubuntu 24.04) com Docker Compose e a Cloudflare na frente. Nenhuma
porta fica aberta para a internet além do SSH: o público chega pelo **Cloudflare Tunnel**.

```
Leitor ──► Cloudflare (DNS, CDN, WAF) ──► túnel ──► cloudflared ──► web (Next :3000) ──► api (:8080) ──► postgres
                                                     └────────────── tudo na rede interna do Compose ──────────────┘
Fotos: R2 (media.<domínio>)        IA: Gemini
```

| Arquivo | Para que serve |
|---|---|
| `infra/compose.prod.yaml` | Banco, API (perfil `prod`), site e `cloudflared`; limites de memória e de log |
| `infra/prod.env.example` | Modelo do `infra/.env` da VPS (segredos; `chmod 600`; nunca versionado) |
| `infra/deploy.sh` | `git pull` → compila e sobe a API → espera ficar pronta → compila o site → troca o site |
| `infra/backup.sh` | `pg_dump` diário em `infra/backups/`, guardando 14 dias |

**Por que o site é compilado na VPS:** o `next build` com `API_URL` busca as notícias na API (páginas estáticas e
listas de endereços). Um build no GitHub Actions não alcança a API de produção, então a imagem do site é feita na
própria VPS, com a API já no ar (`build.network: host` + `API_URL=http://127.0.0.1:8080`). A API fica publicada só
em `127.0.0.1:8080` por isso; o Docker passa por cima do `ufw`, então **nenhum serviço publica porta em `0.0.0.0`**.

## Servidor (já feito em 2026-11-16)

Usuário `vinicius` com sudo; SSH só com chave e sem root (`/etc/ssh/sshd_config.d/00-zsu.conf`); `ufw` só com a 22;
`fail2ban` no SSH; atualizações de segurança automáticas; swap de 4 GB; fuso `America/Sao_Paulo`; Docker do
repositório oficial com logs limitados (`/etc/docker/daemon.json`). Firewall do painel da Hostinger: só a 22.

## 1. Cloudflare: domínio (feito em 2026-11-17)

1. Conta da Cloudflare do jornal → **Add a domain** → `zonasulurgente.com.br` → plano Free. Política de robôs:
   *Search* e *Agents* liberados, *Training* conforme o cliente, *Bot Preference Sync* ligado.
2. Os registros importados (Vercel) foram **todos apagados**: o cliente aceitou o site antigo fora do ar. Os únicos
   registros são os do túnel (raiz e `www`) e o do R2 (`media`).
3. No painel da HostGator (**Domínios → Alterar plataforma → Outra plataforma**), os nameservers da Cloudflare:
   `stephane.ns.cloudflare.com` e `sullivan.ns.cloudflare.com`. Conferir no Registro.br:
   `curl -s https://rdap.registro.br/domain/zonasulurgente.com.br` (campo `nameservers`).
4. **Cuidado:** adicionar o domínio de novo (ou noutra conta) gera **outro par de nameservers**. A HostGator chegou a
   apontar para um par de uma cópia antiga (`hadlee`/`shane`) e o site continuou na Vercel. O par certo é o que a
   página *Overview* do domínio mostra **na conta onde está o túnel**; apague as outras cópias.
5. O `.com` (`zonasulurgente.com`) continua na HostGator, com e-mail (MX). Não mexer sem migrar o e-mail antes.

## 2. Cloudflare: fotos (R2)

1. **R2** → bucket `zsu-media` (Location *Automatic*, classe *Standard*). Pede cartão mesmo no plano grátis.
2. **Manage API tokens** → *Create Account API token* `zsu-api`: **Object Read & Write**, **só o bucket
   `zsu-media`**, TTL *Forever* e **filtro de IP com o IP da VPS** (a chave não funciona fora do servidor).
3. O endpoint (`MEDIA_S3_ENDPOINT`) é `https://<id-da-conta>.r2.cloudflarestorage.com` — **sem** `/zsu-media` no
   fim (a tela do bucket mostra com o nome; tirar).
4. Depois do domínio **Active**: **Settings → Custom Domains** → `media.zonasulurgente.com.br`, TLS mínimo **1.2**
   (1.3 deixaria aparelhos antigos sem foto).

## 3. Cloudflare: túnel

1. **Zero Trust** (equipe `zonasulurgente`, plano Free) → **Networks → Tunnels → Create a tunnel** → *Cloudflared*
   → `zsu-prod`.
2. Copiar o **token** (texto depois de `--token`) para o gerenciador de senhas.
3. A tela nova só libera o *Continue* depois que um conector liga. Ligar um temporário na VPS sem deixar o token no
   histórico: `read -rs TUNNEL_TOKEN` → `docker run -d --name cf-temporario cloudflare/cloudflared:latest tunnel
   --no-autoupdate run --token "$TUNNEL_TOKEN"`; depois `docker rm -f cf-temporario`.
4. **Routes → Add route → Published application**: raiz e `www` de `zonasulurgente.com.br` → `http://web:3000`.
   A Cloudflare cria os registros de DNS do tipo *Tunnel*.
5. Token perdido: **Overview → Add a replica → Docker** mostra o comando de novo (ou *Rotate token*).

## 3b. Cloudflare: token só de leitura do monitor (spec 004)

**My Profile → API Tokens → Create Token → Custom token**: permissão **Account → Account Analytics → Read**, só a conta
do jornal, filtro de IP com o IP da VPS. O token vai em `CLOUDFLARE_ANALYTICS_TOKEN` e o ID da conta (página do R2) em
`CLOUDFLARE_ACCOUNT_ID`. Preencher também `USAGE_AI_*` com os limites do plano grátis do Gemini (Google AI Studio →
*Rate limits*) **antes** de publicar a versão com a spec 004 — sem eles a geração de rascunhos fica esperando.

## 4. VPS: código e segredos

```bash
git clone https://github.com/v2ntechnology/System-zona-sul-urgente-web.git ~/zona-sul-urgente
cd ~/zona-sul-urgente/infra && cp prod.env.example .env && chmod 600 .env
# Segredos gerados no próprio servidor (ninguém precisa copiar):
sed -i "s|^DB_PASSWORD=$|DB_PASSWORD=$(openssl rand -hex 24)|" .env
sed -i "s|^TOTP_ENCRYPTION_KEY=$|TOTP_ENCRYPTION_KEY=$(openssl rand -base64 32)|" .env
sed -i "s|^REVALIDATE_SECRET=$|REVALIDATE_SECRET=$(openssl rand -hex 32)|" .env
grep TOTP_ENCRYPTION_KEY .env    # guardar no gerenciador de senhas: perdê-la invalida todos os 2FA
nano .env                        # R2, GEMINI_API_KEY, TUNNEL_TOKEN, CLOUDFLARED_TAG, ZSU_BOOTSTRAP_ADMIN_*
grep -E "^[A-Z0-9_]+=" .env | sed -E "s/=.+/=(preenchido)/"    # conferir sem mostrar valores
```

Hoje: `SITE_URL=https://zonasulurgente.com.br`, `SITE_ENV=staging` (fora do Google até ter conteúdo),
`CLOUDFLARED_TAG=2026.11.0`.

## 5. Primeiro deploy (feito em 2026-11-17)

```bash
~/zona-sul-urgente/infra/deploy.sh
docker compose -f ~/zona-sul-urgente/infra/compose.prod.yaml logs api | grep -A1 "Primeiro administrador"
```

- **Banco novo não tem editorias nem bairros** (o `db/seed` só existe no perfil `local`). Foram carregadas à mão, uma
  vez, as cidades, zonas, os 18 bairros e as 12 editorias de `db/seed/R__seed_local.sql` (sem as colunas de
  colunistas fictícios), com `ON CONFLICT DO NOTHING`. A redação ajusta as editorias pelo painel.
- Com o banco vazio, `generateStaticParams` voltaria vazio e o `next build` falharia (Cache Components exige ao menos
  um item): `src/lib/static-params.ts` devolve o endereço reservado `_vazio` (404) nesse caso.
- O link do convite do 1º Admin sai no log da API (uso único, 7 dias).

## 6. Backup (falta agendar)

```bash
crontab -e
# 30 3 * * * /home/vinicius/zona-sul-urgente/infra/backup.sh >> /home/vinicius/backup.log 2>&1
```

Restaurar: `docker compose -f infra/compose.prod.yaml exec -T postgres pg_restore -U zonasul -d zonasul --clean
--if-exists /backups/<arquivo>.dump`. A cópia para fora da VPS (R2) é o próximo passo.

## 7. Liberar o Google

Quando a redação tiver publicado as primeiras matérias:

1. No `infra/.env`: `SITE_ENV=production`.
2. `infra/deploy.sh --sem-git` (as variáveis `NEXT_PUBLIC_*` ficam embutidas no build).
3. Regra de redirecionamento na Cloudflare de `www` para a raiz (o `SITE_URL` canônico), para o Google não ver duas
   cópias.

## Dia a dia

| Tarefa | Comando (em `~/zona-sul-urgente`) |
|---|---|
| Publicar uma versão nova | `infra/deploy.sh` |
| Ver o que está rodando | `docker compose -f infra/compose.prod.yaml ps` |
| Logs | `docker compose -f infra/compose.prod.yaml logs -f --tail=100 api` (ou `web`, `cloudflared`) |
| Abrir o banco | `docker compose -f infra/compose.prod.yaml exec postgres psql -U zonasul` |
| API pelo seu computador | `ssh -i ~/.ssh/zsu_vps -L 8080:127.0.0.1:8080 vinicius@<IP>` e abrir `localhost:8080` |
