"""Vercel-friendly entry point.

Vercel's Python builder looks at the ``experimentalServices.backend.entrypoint``
directory (``backend/``) for an ASGI app. This file re-exports the
FastAPI ``app`` from ``app/main.py`` so the builder can find it without
us renaming the canonical app module.

For Docker / Render / local dev, this file is unused — uvicorn targets
``app.main:app`` directly (see ``backend/Dockerfile`` CMD).
"""

from app.main import app  # noqa: F401 — re-exported for Vercel discovery

__all__ = ["app"]
