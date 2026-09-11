#!/usr/bin/env bash
# Runs the commission integration test suite against a real, throwaway
# PostgreSQL 16 container — started and torn down here, never the project's
# real database (docker-compose's "postgres" service is left untouched).
#
# Why not Testcontainers' own Docker lifecycle management (the usual way to
# do this from JUnit)? On some hosts with a very new Docker Desktop, its
# bundled docker-java client cannot complete the handshake with the daemon.
# This script sidesteps that by using the docker CLI directly — the same
# approach used to verify the V10-V12 migrations before this suite existed —
# and just hands the running container's address to Spring via -Dit.db.*.
set -euo pipefail

CONTAINER_NAME="commission-it-pg"
DB_PORT="${IT_DB_PORT:-15433}"
DB_NAME="physiocare_it"
DB_USER="physiocare"
DB_PASSWORD="physiocare"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_DB="$DB_NAME" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -p "${DB_PORT}:5432" postgres:16-alpine >/dev/null

echo "Waiting for $CONTAINER_NAME to accept connections on port $DB_PORT..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"
./mvnw test \
  -Dtest="${1:-com.physiocare.clinic.commission.CommissionFlowTest}" \
  -Dit.db.url="jdbc:postgresql://localhost:${DB_PORT}/${DB_NAME}" \
  -Dit.db.username="$DB_USER" \
  -Dit.db.password="$DB_PASSWORD"
