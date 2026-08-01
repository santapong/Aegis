# ---------- Dependencies stage ----------
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ---------- Build stage ----------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* env vars are inlined at build time. Aegis prefers the
# same-origin Next.js `rewrites()` proxy (see `next.config.ts`), so we
# build with NEXT_PUBLIC_API_URL="" by default — the browser uses
# relative `/api/*` URLs and the proxy handles cross-origin at request
# time via BACKEND_INTERNAL_URL. Override only if you need direct
# browser→backend calls (e.g. AI streaming on Vercel).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# With `output: standalone`, next.config's rewrites() runs at BUILD time
# and the result is frozen into the standalone server — the runtime env
# var is ignored. Bake the in-network backend URL here; without it the
# config falls back to http://localhost:8000, which inside the container
# is the frontend itself (ECONNREFUSED on every proxied /api call).
ARG BACKEND_INTERNAL_URL="http://backend:8000"
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

RUN bun run build

# ---------- Production stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy built Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# NOTE: BACKEND_INTERNAL_URL is NOT read at request time in this image —
# standalone output freezes the rewrite destination at build time (see
# the builder stage). Rebuild with --build-arg BACKEND_INTERNAL_URL=…
# to point the proxy elsewhere.

CMD ["node", "server.js"]
