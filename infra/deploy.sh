#!/usr/bin/env bash
# Deploy na VPS: atualiza o código, sobe banco + API, compila o site com a API no ar e troca o site.
# Uso (na VPS, dentro do repositório):  infra/deploy.sh            (atualiza do git e faz o deploy)
#                                       infra/deploy.sh --sem-git  (só recompila o que está na pasta)
set -euo pipefail
cd "$(dirname "$0")"
compose() { docker compose -f compose.prod.yaml "$@"; }

[ -f .env ] || { echo "Falta infra/.env (copie de prod.env.example)." >&2; exit 1; }
[ "$(stat -c %a .env)" = "600" ] || { echo "Proteja o infra/.env:  chmod 600 infra/.env" >&2; exit 1; }

if [ "${1:-}" != "--sem-git" ]; then
  git -C .. pull --ff-only
fi
echo "==> Versão: $(git -C .. log -1 --format='%h %s')"

echo "==> Compilando a API"
compose build api
echo "==> Subindo banco e API (as migrações rodam ao ligar)"
compose up -d postgres api

echo "==> Esperando a API ficar pronta"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8080/actuator/health/readiness > /dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
[ "${ok:-}" = 1 ] || { echo "A API não ficou pronta em 5 min. Veja: docker compose -f infra/compose.prod.yaml logs api" >&2; exit 1; }

echo "==> Compilando o site (busca as notícias na API)"
compose build web
echo "==> Trocando o site e ligando o túnel"
compose up -d web cloudflared

docker image prune -f > /dev/null
compose ps
echo "==> Pronto."
