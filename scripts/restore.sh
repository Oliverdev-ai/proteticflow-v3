#!/bin/bash
set -euo pipefail

S3_BUCKET="${BACKUP_S3_BUCKET:-proteticflow-backups}"

if [[ -z "${1:-}" ]]; then
  echo "Uso: ./restore.sh <nome_do_backup>"
  echo "Backups disponiveis:"
  aws s3 ls "s3://${S3_BUCKET}/" --human-readable
  exit 1
fi

FILENAME="$1"
echo "[restore] Downloading ${FILENAME}..."
aws s3 cp "s3://${S3_BUCKET}/${FILENAME}" "/tmp/${FILENAME}"

echo "[restore] Restoring to PostgreSQL..."
gunzip -c "/tmp/${FILENAME}" | psql "$DATABASE_URL"

echo "[restore] Cleaning up..."
rm "/tmp/${FILENAME}"
echo "[restore] Done."
