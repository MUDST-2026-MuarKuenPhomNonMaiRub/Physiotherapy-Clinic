# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run with Docker

```bash
bash setup-local.sh
```

The first run creates the PostgreSQL database and a local bootstrap admin account.
The setup script generates a random admin password and prints it once. Do not
commit `.env`.

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

`run-local.sh` loads the project's `.env` before starting Spring. Maven does not
read that file on its own — running `./mvnw spring-boot:run` directly fails with
`Could not resolve placeholder 'APP_JWT_SECRET'`.

## Structure

- `frontend/`: Next.js, React and TypeScript clinic ERP UI.
- `backend/`: Spring Boot 3 REST API with PostgreSQL, Flyway, Spring Security and JWT authentication.
