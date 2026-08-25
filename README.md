# PhysioCare Clinic

Starter monorepo based on the Clinic Figma design.

## Run locally

```bash
cd backend && ./mvnw spring-boot:run
```

```bash
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:5173 · API: http://localhost:8080/api/branches

## Structure

- `frontend/`: React + TypeScript + Vite, responsive Figma-based UI, typed API service.
- `backend/`: Spring Boot 3 REST API with validation and CORS. In-memory data is intentional scaffolding; replace the controller store with a service/repository and JPA when the database is selected.
