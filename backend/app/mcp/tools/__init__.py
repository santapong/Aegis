"""MCP tool registry.

Each tool module exposes ``TOOLS`` (list of mcp.types.Tool) and ``HANDLERS``
(mapping name -> callable). The server imports both and registers them with
the underlying mcp.Server.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from mcp import types

from . import budgets, plans, reports, transactions, trips, ai


ToolHandler = Callable[[dict[str, Any]], Awaitable[str]]


def all_tools() -> list[types.Tool]:
    return [
        *transactions.TOOLS,
        *budgets.TOOLS,
        *plans.TOOLS,
        *trips.TOOLS,
        *reports.TOOLS,
        *ai.TOOLS,
    ]


def all_handlers() -> dict[str, ToolHandler]:
    return {
        **transactions.HANDLERS,
        **budgets.HANDLERS,
        **plans.HANDLERS,
        **trips.HANDLERS,
        **reports.HANDLERS,
        **ai.HANDLERS,
    }
