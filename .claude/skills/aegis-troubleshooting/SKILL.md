---
name: aegis-troubleshooting
description: Known startup, build, Docker, and auth bugs encountered when running the Aegis stack from a fresh checkout — with how each was diagnosed and fixed. Trigger when bringing the stack up, debugging a frontend build failure, hitting a port conflict on `docker compose up`, or investigating login / "Session expired" behavior.
---

# Aegis — Known Issues & Fixes

A running log of bugs hit while bringing this repo up, how each was diagnosed, and the fix. Check here before re-investigating a familiar symptom.

Working sequence after these fixes:

```sh
make setup                                  # generates .env (idempotent)
echo "DB_PORT=5433" >> .env                  # only if host 5432 is busy
docker compose up -d --build                 # prod compose; see issue #4 re: dev override
docker exec aegis-backend-1 python -m app.seeds.demo
# Frontend: http://localhost:3000   Backend: http://localhost:8000/api/health
# Demo: demo@aegis.local / demo-password-123
```

---

## 1. Port 5432 already in use on `docker compose up`

**Symptom**

```
Error response from daemon: failed to set up container networking:
... failed to bind host port 0.0.0.0:5432/tcp: address already in use
```

The `db` container fails to start; backend then never becomes healthy.

**How it was found**: `docker compose up -d --build` exit message named the bound port and container.

**Cause**: Host already has something on 5432 (host Postgres, another stack). Compose maps `${DB_PORT:-5432}:5432` (see `docker-compose.yml`).

**Fix**: pick a free host port via `DB_PORT`. Backend reaches Postgres on the internal network, so the host mapping is only for outside access — changing it does not affect app behavior.

```sh
echo "DB_PORT=5433" >> .env
docker compose up -d
```

---

## 2. Frontend build fails: `iconPosition` not on `ButtonProps`

**Symptom**

```
./src/app/welcome/page.tsx:112:65
Type error: Property 'iconPosition' does not exist on type
'IntrinsicAttributes & ButtonProps & RefAttributes<HTMLButtonElement>'.
```

**How it was found**: TypeScript error in the frontend Docker build (`bun run build`). `grep -rn iconPosition frontend/src` showed exactly one usage — the welcome page.

**Cause**: `frontend/src/app/welcome/page.tsx` passes `iconPosition="right"` to render an arrow after the label, but `frontend/src/components/ui/button.tsx` only supported `icon` (always before children) — no `iconPosition` prop.

**Fix**: added `iconPosition?: "left" | "right"` (default `"left"`) to `ButtonProps` and rendered the icon on the chosen side. See `frontend/src/components/ui/button.tsx`.

---

## 3. Frontend build fails: `Cannot find module 'driver.js/dist/driver.css'`

**Symptom**

```
./src/components/onboarding-tour.tsx:75
Type error: Cannot find module 'driver.js/dist/driver.css' or its
corresponding type declarations.
> 75 |       await import("driver.js/dist/driver.css");
```

**How it was found**: TypeScript error during Docker build, only after fixing issue #2.

**Cause**: With `moduleResolution: "bundler"` (see `frontend/tsconfig.json`), TS demands type declarations for the package-relative CSS path inside a dynamic `await import(...)`. Next.js bundles CSS side-effect imports fine — the failure is purely TS resolution at build time.

**Fix**: hoist the CSS to a top-level side-effect import; keep `driver.js` (the JS) lazily loaded. In `frontend/src/components/onboarding-tour.tsx`:

```ts
"use client";
import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";   // <-- moved here
// ...
const mod = await import("driver.js");  // JS still lazy
```

---

## 4. Frontend container restart loop with dev override: `Cannot find module '/app/bun'`

**Symptom** (after `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`):

```
Container aegis-frontend-1   Restarting (1) ...
docker logs aegis-frontend-1:
Error: Cannot find module '/app/bun'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
```

**How it was found**: `docker compose ps` showed the frontend container in a restart loop while backend + db were healthy; `docker logs aegis-frontend-1` revealed the Node error.

**Cause**: `docker-compose.dev.yml` overrides `command: bun run dev`, but the frontend `Dockerfile` runner stage is `node:20-alpine` — bun is not installed there (it lives only in the `deps` and `builder` stages). The node entrypoint then interprets `bun` as a script path for `node`, hence the misleading "Cannot find module /app/bun" error.

**Fix used for "I just want to test the app"**: skip the dev override and use the prebuilt prod image — no hot reload, but everything works.

```sh
docker compose down
docker compose up -d --build              # prod compose only
```

**Proper fix (not yet applied)**: in `docker-compose.dev.yml`, point the frontend build at the `builder` stage (which has bun + node_modules + source):

```yaml
services:
  frontend:
    build:
      context: ./frontend
      target: builder        # add this
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    command: bun run dev
```

---

## 5. Login shows "Session expired" instead of logging in

**Symptom**: user enters valid credentials on `/login`, clicks Sign in, and sees the red "Session expired" banner. `curl -X POST http://localhost:8000/api/auth/login` with the same credentials returns a valid token.

**How it was found**:

1. `curl` proved the backend authenticates the demo user fine — so the issue is client-side.
2. `grep -rn "Session expired" frontend/src` led to `frontend/src/lib/api.ts` — `fetchJSON` throws `"Session expired"` on **any** 401.
3. Reading `frontend/src/app/login/page.tsx` `handleSubmit`:

   ```ts
   const tokenRes = await authAPI.login({ email, password });  // fresh token returned
   const userRes  = await authAPI.me();                        // reads token from STORE
   login(tokenRes.access_token, userRes);                      // store updated only here
   ```

4. `frontend/src/stores/auth-store.ts` persists to localStorage under key `aegis-auth`. When `make setup` regenerates `JWT_SECRET_KEY`, any persisted token from a previous Aegis run can no longer verify against the new secret.
5. So `me()` runs with the stale token still sitting in the store, backend returns 401, `fetchJSON` displays "Session expired" — even though the login call immediately above succeeded.

**Fix** (three small changes, all together):

- `frontend/src/stores/auth-store.ts` — add a `setToken(token: string)` action.
- `frontend/src/app/login/page.tsx` and `frontend/src/app/register/page.tsx` — call `setToken(tokenRes.access_token)` **before** calling `authAPI.me()`.
- `frontend/src/lib/api.ts` — skip the `Authorization` header for the public endpoints `/api/auth/login` and `/api/auth/register` so a stale token cannot poison those calls; surface a 401 from those endpoints as `"Invalid credentials"` rather than the misleading `"Session expired"`.

**User-side workaround if it ever resurfaces**: open DevTools → Application → Local Storage → `http://localhost:3000` → delete `aegis-auth`, then hard-refresh.

---

## Diagnostic patterns that paid off here

- **Trust `curl` over the UI** for auth: a working `curl /api/auth/login` proved the bug was in the client, not the backend — narrowed scope by half.
- **Always check `docker logs <container>`** when `docker compose ps` shows a restart loop. The compose-level error is usually too generic to act on.
- **`grep -rn` the user-visible string** ("Session expired", error names) to find the exact throw site fast.
- **Read the call sequence around persisted state**: state-set-after-read races (login → me → store-update) hide behind otherwise-correct-looking code.
