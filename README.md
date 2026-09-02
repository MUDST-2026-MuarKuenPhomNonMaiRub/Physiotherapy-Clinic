# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

The first run creates the PostgreSQL database and the bootstrap admin account
from `.env`. Use `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` to log in.
Do not commit `.env`.

For a shared team database, put the same cloud PostgreSQL JDBC connection URL
in `DATABASE_URL_DOCKER` in every person's private `.env` file. Keep the
username, password and URL private. The Flyway migrations run against that
shared database when the backend starts, so all team members use the same users
and staff accounts.

Frontend: http://localhost:3000 · API: http://localhost:8080

To stop the application without deleting data:

```bash
docker compose down
```

For local development without Docker, start PostgreSQL with `docker compose up -d postgres`,
then run the backend and frontend in separate terminals.

## Structure

- `frontend/`: Next.js, React and TypeScript clinic ERP UI.
- `backend/`: Spring Boot 3 REST API with PostgreSQL, Flyway, Spring Security and JWT authentication.
