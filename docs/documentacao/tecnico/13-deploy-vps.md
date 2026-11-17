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

## 1. Cloudflare: domínio

1. Criar a conta, **Add a domain** → o `.com.br` → plano Free.
2. Conferir os registros importados com os da Vercel (inclusive o curinga `*` e os **CAA**). Enquanto apontarem para
   a Vercel, o site antigo continua no ar.
3. No painel da HostGator (Registro.br), trocar os servidores de DNS pelos dois que a Cloudflare mostrar. Esperar a
   Cloudflare marcar o domínio como **Active**.

## 2. Cloudflare: fotos (R2)

1. **R2** → criar o bucket `zsu-media`.
2. **Settings → Custom domains** → `media.<domínio>` (vira `MEDIA_PUBLIC_URL`).
3. **Manage API tokens** → token com **Object Read & Write** só nesse bucket → anotar *Access Key ID*, *Secret Access
   Key* e o endpoint `https://<id-da-conta>.r2.cloudflarestorage.com`.

## 3. Cloudflare: túnel

1. **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared* → nome `zsu-prod`.
2. Na tela de instalação, copiar só o **token** (o texto depois de `--token`) para `TUNNEL_TOKEN`.
3. **Public hostname**: `novo.<domínio>` → serviço `HTTP` → `web:3000` (a prévia).

## 4. VPS: código e segredos

```bash
# O repositório é público (nenhum segredo nele): o servidor só lê, sem chave.
git clone https://github.com/v2ntechnology/System-zona-sul-urgente-web.git ~/zona-sul-urgente
cd ~/zona-sul-urgente/infra
cp prod.env.example .env && chmod 600 .env
openssl rand -base64 32     # um para cada: DB_PASSWORD, TOTP_ENCRYPTION_KEY, REVALIDATE_SECRET
nano .env
```

Na prévia: `SITE_URL=https://novo.<domínio>` e `SITE_ENV=staging` (fora do Google). No primeiro deploy, preencher
`ZSU_BOOTSTRAP_ADMIN_EMAIL` com o e-mail de quem vai administrar.

## 5. Primeiro deploy

```bash
~/zona-sul-urgente/infra/deploy.sh
docker compose -f ~/zona-sul-urgente/infra/compose.prod.yaml logs api | grep -i convite   # link do 1º Admin
```

O primeiro build leva alguns minutos (Maven e npm baixam tudo). Depois, `https://novo.<domínio>` deve abrir o site
novo. O Admin entra pelo link do convite, cadastra a senha e o 2FA e convida a equipe.

## 6. Backup

```bash
crontab -e
# 30 3 * * * /home/vinicius/zona-sul-urgente/infra/backup.sh >> /home/vinicius/backup.log 2>&1
```

Restaurar: `docker compose -f infra/compose.prod.yaml exec -T postgres pg_restore -U zonasul -d zonasul --clean
--if-exists /backups/<arquivo>.dump`. A cópia para fora da VPS (R2) é o próximo passo.

## 7. Virar o site oficial

Com a aprovação do cliente:

1. No túnel, **Public hostname** para o domínio e para `www` → `HTTP web:3000` (substitui os registros da Vercel).
2. No `infra/.env`: `SITE_URL=https://<domínio>` e `SITE_ENV=production` (libera o Google).
3. `infra/deploy.sh --sem-git` (as variáveis `NEXT_PUBLIC_*` ficam embutidas no build).

## Dia a dia

| Tarefa | Comando (em `~/zona-sul-urgente`) |
|---|---|
| Publicar uma versão nova | `infra/deploy.sh` |
| Ver o que está rodando | `docker compose -f infra/compose.prod.yaml ps` |
| Logs | `docker compose -f infra/compose.prod.yaml logs -f --tail=100 api` (ou `web`, `cloudflared`) |
| Abrir o banco | `docker compose -f infra/compose.prod.yaml exec postgres psql -U zonasul` |
| API pelo seu computador | `ssh -i ~/.ssh/zsu_vps -L 8080:127.0.0.1:8080 vinicius@<IP>` e abrir `localhost:8080` |
