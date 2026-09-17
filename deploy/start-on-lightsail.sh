#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  sh deploy/init-env.sh
fi

docker network inspect levelup-net >/dev/null 2>&1 || docker network create levelup-net
docker compose config --quiet
docker compose up -d --build
docker compose ps

echo 'Checking local API...'
attempt=0
while [ "$attempt" -lt 20 ]; do
  if curl --fail --silent http://127.0.0.1:19120/api/health; then
    echo
    echo 'ZZAL is running locally. Connect the shared Nginx using deploy/nginx/zzal.conf.'
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 3
done

echo 'API did not become ready. Check: docker compose logs --tail=100 web backend db' >&2
exit 1
