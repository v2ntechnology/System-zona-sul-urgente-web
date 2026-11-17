#!/usr/bin/env bash
# Backup do banco (formato custom do pg_dump) em infra/backups/, guardando os últimos 14 dias.
# Agendar na VPS (crontab -e do usuário vinicius):
#   30 3 * * * /home/vinicius/zona-sul-urgente/infra/backup.sh >> /home/vinicius/backup.log 2>&1
# A cópia para fora da VPS (R2) entra quando o bucket existir — ver docs/documentacao/tecnico/13-deploy-vps.md.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
file="zonasul-$(date +%Y-%m-%d_%H%M).dump"
docker compose -f compose.prod.yaml exec -T postgres pg_dump -U zonasul -d zonasul -Fc -f "/backups/$file"
find backups -name 'zonasul-*.dump' -mtime +14 -delete
echo "$(date '+%F %T') backup ok: infra/backups/$file ($(du -h "backups/$file" | cut -f1))"
