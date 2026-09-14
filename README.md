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
