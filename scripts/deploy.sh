#!/bin/bash
set -euo pipefail

echo "[deploy] Pulling latest images..."
docker compose -f docker/docker-compose.prod.yml pull

echo "[deploy] Running migrations..."
docker compose -f docker/docker-compose.prod.yml run --rm server \
  node apps/server/dist/db/migrate.js

echo "[deploy] Starting services..."
docker compose -f docker/docker-compose.prod.yml up -d

echo "[deploy] Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "[deploy] Server healthy!"
    exit 0
  fi
  sleep 2
done

echo "[deploy] WARN: Health check did not pass in 60s"
exit 1
