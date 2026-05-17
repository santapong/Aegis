# ---------- Build stage ----------
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv pip install --system --no-cache -r pyproject.toml

# ---------- Production stage ----------
FROM python:3.12-slim

WORKDIR /app

# WeasyPrint runtime deps — Cairo / Pango / GDK-Pixbuf / fonts. Without these
# the /api/reports/export.pdf endpoint crashes on first request on any
# platform that doesn't pre-bake them (AWS ECS, GCP Cloud Run, etc).
# Adds ~80 MB to the image but the alternative is silent PDF failure.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

COPY . .

# Entrypoint runs DB wait + alembic upgrade before execing the main command.
RUN cp /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Container-level liveness check. Render / Fly / Kubernetes can layer
# their own probes on top; this is the fallback for bare `docker run`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)" \
    || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
# --proxy-headers + --forwarded-allow-ips=* honors X-Forwarded-* from
# Vercel / Cloudflare / ALB so request.client.host and HTTPS detection
# match the real client. --timeout-graceful-shutdown gives in-flight
# requests 25 s to finish before SIGKILL on container stop.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--proxy-headers", \
     "--forwarded-allow-ips=*", \
     "--timeout-graceful-shutdown", "25"]
