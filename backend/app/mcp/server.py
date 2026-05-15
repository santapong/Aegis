"""Aegis MCP server — stdio transport.

Usage::

    AEGIS_USER_EMAIL=you@example.com DATABASE_URL=... aegis-mcp

Register with Claude Desktop via the `mcpServers` block (see README).
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .session import MCPSessionError, resolve_user_id
from .tools import all_handlers, all_tools


logger = logging.getLogger("aegis-mcp")


def _configure_logging() -> None:
    level_name = os.environ.get("AEGIS_MCP_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    # MCP uses stdout for the protocol; logs MUST go to stderr.
    logging.basicConfig(
        level=level,
        stream=sys.stderr,
        format="%(asctime)s %(levelname)s aegis-mcp %(message)s",
    )


def build_server() -> Server:
    server = Server("aegis", version="0.9.0")
    handlers = all_handlers()
    tools = all_tools()

    @server.list_tools()
    async def _list_tools() -> list[types.Tool]:
        return tools

    @server.call_tool()
    async def _call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
        handler = handlers.get(name)
        if handler is None:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]
        try:
            result = await handler(arguments or {})
            return [types.TextContent(type="text", text=result)]
        except MCPSessionError as exc:
            logger.error("session error in %s: %s", name, exc)
            return [types.TextContent(type="text", text=f"Session error: {exc}")]
        except Exception as exc:  # noqa: BLE001 — surface error to MCP client
            logger.exception("tool %s failed", name)
            return [types.TextContent(type="text", text=f"Error in {name}: {exc}")]

    return server


async def _run() -> None:
    _configure_logging()
    try:
        user_id = resolve_user_id()
        logger.info("resolved AEGIS_USER_EMAIL to user_id=%s", user_id)
    except MCPSessionError as exc:
        logger.error("startup failed: %s", exc)
        # Continue running so the MCP client gets a structured error per-call
        # rather than a silent process exit.

    server = build_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main() -> None:
    """Console-script entry point used by `aegis-mcp`."""
    asyncio.run(_run())


if __name__ == "__main__":
    main()
