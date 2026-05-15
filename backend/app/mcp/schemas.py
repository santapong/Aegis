"""Helpers for turning Pydantic models into MCP-compatible JSON Schemas."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


def pydantic_to_mcp_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Return a JSON Schema dict from a Pydantic model.

    Strips Pydantic's ``$defs``/``$ref`` indirection by inlining definitions
    so MCP clients (which often validate with stricter schema parsers) get a
    flat ``object`` schema with ``properties`` and ``required``.
    """
    schema = model.model_json_schema()
    defs = schema.pop("$defs", None) or schema.pop("definitions", None) or {}

    def inline(obj: Any) -> Any:
        if isinstance(obj, dict):
            if "$ref" in obj and obj["$ref"].startswith("#/$defs/"):
                ref = obj["$ref"].split("/")[-1]
                if ref in defs:
                    resolved = inline(defs[ref])
                    extra = {k: v for k, v in obj.items() if k != "$ref"}
                    return {**resolved, **extra}
            return {k: inline(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [inline(v) for v in obj]
        return obj

    return inline(schema)
