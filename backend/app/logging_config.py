"""Loguru configuration for Aegis.

Two output formats:
- "text": human-readable, colorized, shows request_id inline. Good for dev.
- "json": one JSON object per line on stdout. Good for prod / log aggregators.

Call `configure_logging(settings.log_format, settings.debug)` once at app import
time, before FastAPI is constructed.
"""

from __future__ import annotations

import json
import sys

from loguru import logger


def _json_sink(message) -> None:
    record = message.record
    payload = {
        "ts": record["time"].isoformat(),
        "level": record["level"].name,
        "msg": record["message"],
        "module": record["name"],
        "line": record["line"],
    }
    # Extras (including request_id injected by RequestIDMiddleware) go to the top level.
    for key, value in record["extra"].items():
        payload[key] = value
    if record["exception"]:
        payload["exception"] = str(record["exception"])
    print(json.dumps(payload, default=str), file=sys.stdout, flush=True)


def _ensure_request_id(record) -> bool:
    record["extra"].setdefault("request_id", "-")
    return True


def configure_logging(log_format: str, debug: bool) -> None:
    logger.remove()
    level = "DEBUG" if debug else "INFO"

    if log_format == "json":
        logger.add(_json_sink, level=level, filter=_ensure_request_id)
        return

    logger.add(
        sys.stdout,
        level=level,
        colorize=True,
        filter=_ensure_request_id,
        format=(
            "<green>{time:HH:mm:ss}</green> "
            "<level>{level: <8}</level> "
            "<cyan>[{extra[request_id]}]</cyan> "
            "<level>{message}</level>"
        ),
    )
