#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo '.env already exists; leaving it unchanged.' >&2
  exit 1
fi

umask 077
db_password="$(openssl rand -hex 24)"
session_secret="$(openssl rand -hex 32)"
sed \
  -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_password/" \
  -e "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" \
  .env.docker.example > .env
chmod 600 .env
echo 'Created .env with random database and session secrets.'
echo 'Set OAuth and Cafe24 API keys in .env before enabling those features.'
