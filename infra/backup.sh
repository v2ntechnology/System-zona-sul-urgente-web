#!/usr/bin/env bash
# Backup do banco (formato custom do pg_dump) em infra/backups/, guardando os últimos 14 dias.
# Agendar na VPS (crontab -e do usuário vinicius):
#   30 3 * * * /home/vinicius/zona-sul-urgente/infra/backup.sh >> /home/vinicius/backup.log 2>&1
# A cópia para fora da VPS (R2) entra quando o bucket existir — ver docs/documentacao/tecnico/13-deploy-vps.md.
set -euo pipefail
cd "$(dirname "$0")"
file="zonasul-$(date +%Y-%m-%d_%H%M).dump"
pg() { docker compose -f compose.prod.yaml exec -T postgres "$@"; }
pg pg_dump -U zonasul -d zonasul -Fc -f "/backups/$file"
# A pasta é criada pelo Docker como root: dentro do contêiner, entrega pasta e arquivos ao usuário do servidor e
# fecha para os outros (o backup tem dados sensíveis, como as senhas cifradas da equipe).
pg sh -c "chown $(id -u):$(id -g) /backups /backups/*.dump && chmod 700 /backups && chmod 600 /backups/*.dump"
find backups -name 'zonasul-*.dump' -mtime +14 -delete
echo "$(date '+%F %T') backup ok: infra/backups/$file ($(du -h "backups/$file" | cut -f1))"
