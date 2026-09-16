# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run with Docker

Three commands from a clean clone:

```bash
git clone -b dev3 https://github.com/MUDST-2026-MuarKuenPhomNonMaiRub/Physiotherapy-Clinic.git
cd Physiotherapy-Clinic
```

```bash
bash setup-local.sh
```

```bash
docker compose up -d --build
```

`setup-local.sh` writes a private `.env` with a freshly generated JWT secret and
admin password, and **prints that password once** — copy it before moving on. It
does not start anything, so the build stays a separate, visible step. Running it
again leaves your own settings alone and only fills in values still holding the
template placeholders. Never commit `.env`.

The first build takes five to ten minutes. Flyway then creates every table and
the starting catalogue when the API container comes up, so the clinic screens
have services, courses, rooms and payment methods to work with.

For a shared team database, put the same cloud PostgreSQL JDBC connection URL
in `DATABASE_URL_DOCKER`, username in `DATABASE_USERNAME_DOCKER`, and password
in `DATABASE_PASSWORD_DOCKER` in every person's private `.env` file. Keep the
username, password and URL private. The Flyway migrations run against that
shared database when the backend starts, so all team members use the same users
and staff accounts.

Frontend: http://localhost:3000 · API: http://localhost:8080

To stop the application without deleting data:

```bash
docker compose down
```

### If the backend won't start with "Migration checksum mismatch" or "Detected applied migration not resolved locally"

A commit rewrote `V6` and removed `V7`, `V14`, `V15` after they had already been
applied on some databases (this repo's own local Postgres included). Flyway
refuses to start against any database that already ran the old versions,
because it can no longer prove the new files describe the same history.

- **Local Docker Postgres, no data you need to keep:** reset it —
  `docker compose down -v` then `docker compose up -d --build`. Flyway
  replays the full migration set from scratch on the empty volume.
- **The shared cloud database** (`DATABASE_URL_DOCKER` in `.env`), or any
  local database with data worth keeping: do **not** reset it. Reconcile
  Flyway's bookkeeping instead, with the official Flyway CLI's `repair`
  command — it only rewrites `flyway_schema_history` rows to match the
  current migration files; it never touches table data or re-runs SQL:

  ```bash
  docker run --rm \
    -v "$(pwd)/backend/src/main/resources/db/migration:/flyway/sql" \
    flyway/flyway:11 \
    -url="<the DATABASE_URL_DOCKER value, as a jdbc:postgresql:// URL>" \
    -user="<DATABASE_USERNAME_DOCKER>" -password="<DATABASE_PASSWORD_DOCKER>" \
    repair
  ```

  Run this once per database that already has data (ask in the team chat
  before running it against the shared one, so it isn't repaired twice at
  once). Afterwards `docker compose up -d --build` starts normally.

**Rule for everyone:** once a migration file is on `dev3`, never edit it
again — add a new `V<next>__*.sql` instead. (Commit `9dd42e3` edited `V5` and
`V20` after they had shipped; those files were restored and the change moved
to `V23`, so a database that ran the original `V5`/`V20` starts cleanly. A
database that ran the *edited* `V5`/`V20` — one first created between that
commit and `V23` — needs the `repair` command above once.)

Avoid this in future: once a migration has shipped to the shared database,
treat its file as frozen — add a new migration to change course instead of
editing or deleting one that already ran.

## Developing with hot reload

Docker rebuilds the whole image on every change, so day-to-day work runs the
two apps on the host against the containerised database. Three terminals:

```bash
docker compose up -d postgres
```

```bash
bash backend/run-local.sh
```

```bash
cd frontend && npm install && npm run dev
```

`run-local.sh` loads the project's `.env` before starting Spring. It uses
`DATABASE_URL_LOCAL` when set, otherwise builds a host URL from `POSTGRES_PORT`
(and `POSTGRES_DB`), matching Compose. Maven does not read `.env` on its own —
running `./mvnw spring-boot:run` directly fails with `Could not resolve
placeholder 'APP_JWT_SECRET'`.

## Backend tests

From `backend/`, the standard command runs unit and request-validation tests
without requiring PostgreSQL:

```bash
./mvnw test
```

The commission tests use real disposable PostgreSQL and are intentionally
excluded from the default Maven run. Run them through the safe setup script,
which starts and removes its own database container:

```bash
bash run-commission-tests.sh
```

Docker must be running. Set `IT_DB_PORT` if port `15433` is already occupied.
Do not point these tests at the application's normal database.

## Structure

- `frontend/`: Next.js, React and TypeScript clinic ERP UI.
- `backend/`: Spring Boot 3 REST API with PostgreSQL, Flyway, Spring Security and JWT authentication.
