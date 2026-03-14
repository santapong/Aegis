# Docker Compose Verification Plan

## Current Issues Found

After analyzing the project, here are the problems that will prevent `docker compose up` from running successfully:

### Issue 1: Missing `.env` file
- `docker-compose.yml` references `env_file: .env` but only `.env.example` exists
- **Fix**: Create `.env` from `.env.example` with corrected `DATABASE_URL`

### Issue 2: Wrong `DATABASE_URL` for Docker networking
- `.env.example` uses `localhost` in `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/money_management`
- Inside Docker Compose, the backend must connect to the `db` service by its service name
- **Fix**: Change to `postgresql://postgres:postgres@db:5432/money_management`

### Issue 3: No database readiness check
- `depends_on: db` only waits for the container to **start**, not for PostgreSQL to be **ready**
- Backend will crash with connection refused if it starts before PostgreSQL accepts connections
- **Fix**: Add `healthcheck` to the `db` service and use `depends_on` with `condition: service_healthy`

### Issue 4: No `.dockerignore` files
- Without `.dockerignore`, unnecessary files (`.git`, `node_modules`, `__pycache__`, `.env`) get copied into images, making builds slow and potentially leaking secrets
- **Fix**: Add `.dockerignore` files for both backend and frontend

### Issue 5: Frontend needs `NEXT_PUBLIC_API_URL` environment variable
- The frontend needs to know the backend API URL to make requests
- **Fix**: Add environment variable to the frontend service in `docker-compose.yml`

### Issue 6: Backend healthcheck missing
- Frontend `depends_on: backend` doesn't guarantee the backend API is ready
- **Fix**: Add healthcheck to backend service using the `/api/health` endpoint

---

## Implementation Steps

### Step 1: Create `.env` file with correct Docker networking values
```
DATABASE_URL=postgresql://postgres:postgres@db:5432/money_management
ANTHROPIC_API_KEY=sk-ant-xxxxx
DEBUG=true
CORS_ORIGINS=["http://localhost:3000"]
```

### Step 2: Update `docker-compose.yml`
- Add `healthcheck` to `db` service (using `pg_isready`)
- Add `healthcheck` to `backend` service (using `/api/health` endpoint)
- Update `depends_on` to use `condition: service_healthy` for proper startup ordering
- Add `NEXT_PUBLIC_API_URL` env var to frontend
- Add `restart: unless-stopped` to all services for resilience

Updated docker-compose.yml:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: money_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d money_management"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      backend:
        condition: service_healthy
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: bun run dev

volumes:
  pgdata:
```

### Step 3: Add `backend/.dockerignore`
```
__pycache__
*.pyc
.env
.git
.venv
*.egg-info
```

### Step 4: Add `frontend/.dockerignore`
```
node_modules
.next
.git
.env
```

### Step 5: Install `curl` in backend Dockerfile (needed for healthcheck)
Add `RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*` to the backend Dockerfile.

### Step 6: Verify with `docker compose up`
Run `docker compose up --build` and confirm:
- [ ] PostgreSQL starts and passes healthcheck
- [ ] Backend starts, connects to DB, passes healthcheck at `/api/health`
- [ ] Frontend starts and is accessible at `http://localhost:3000`
- [ ] No error logs in any service

---

## Expected Startup Order (after fixes)
1. `db` starts → healthcheck passes (PostgreSQL ready)
2. `backend` starts → connects to `db` → healthcheck passes (`/api/health` returns OK)
3. `frontend` starts → connects to `backend` API
