#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="proteticflow_backup_${DATE}.sql.gz"
S3_BUCKET="${BACKUP_S3_BUCKET:-proteticflow-backups}"

echo "[backup] Dumping PostgreSQL..."
pg_dump "$DATABASE_URL" | gzip > "/tmp/${FILENAME}"

echo "[backup] Uploading to S3..."
aws s3 cp "/tmp/${FILENAME}" "s3://${S3_BUCKET}/${FILENAME}"

echo "[backup] Cleaning up local file..."
rm "/tmp/${FILENAME}"

echo "[backup] Removing backups older than 30 days..."
aws s3 ls "s3://${S3_BUCKET}/" | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $1}')
  FILE_NAME=$(echo "$line" | awk '{print $4}')
  if [[ -n "$FILE_NAME" ]]; then
    AGE_DAYS=$(( ($(date +%s) - $(date -d "$FILE_DATE" +%s)) / 86400 ))
    if [[ $AGE_DAYS -gt 30 ]]; then
      echo "[backup] Removing old backup: $FILE_NAME"
      aws s3 rm "s3://${S3_BUCKET}/${FILE_NAME}"
    fi
  fi
done

echo "[backup] Done: ${FILENAME}"
