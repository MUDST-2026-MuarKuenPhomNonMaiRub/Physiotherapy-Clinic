#!/usr/bin/env bash
# Starts the API on the host for development, with hot reload.
#
# Docker Compose reads the project's .env by itself; Maven does not, so the
# same file is loaded here before Spring starts. Without it the application
# stops at "Could not resolve placeholder 'APP_JWT_SECRET'".
#
# Expects the local PostgreSQL to be up:  docker compose up -d postgres

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$(dirname "$script_dir")/.env"

if [ ! -f "$env_file" ]; then
  echo "ไม่พบไฟล์ .env — รัน 'bash setup-local.sh' ที่โฟลเดอร์หลักก่อน" >&2
  echo "No .env found. Run 'bash setup-local.sh' in the project root first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

# .env carries the URL the backend container uses, where the database answers
# to the hostname "postgres". From the host it is on localhost instead.
export DATABASE_URL="${DATABASE_URL_LOCAL:-jdbc:postgresql://localhost:5432/${POSTGRES_DB:-physiocare}}"
export DATABASE_USERNAME="${POSTGRES_USER:-physiocare}"
export DATABASE_PASSWORD="${POSTGRES_PASSWORD:-physiocare}"

if [ -z "${APP_JWT_SECRET:-}" ]; then
  echo "APP_JWT_SECRET ว่างอยู่ใน .env — สร้างด้วย: openssl rand -base64 32" >&2
  exit 1
fi

echo "API: http://localhost:${PORT:-8080}  ·  DB: $DATABASE_URL"
cd "$script_dir"
exec ./mvnw -B spring-boot:run
