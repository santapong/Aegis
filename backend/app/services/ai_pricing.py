"""Cost estimation for metered AI usage.

Two sources of truth, in preference order:

1. **The provider's own model list**, when it publishes per-token prices.
   Groq does, on every chat model. This is always current and needs no
   maintenance, so it is strongly preferred.
2. **The table below**, for providers that publish nothing (Anthropic's models
   endpoint returns capabilities but no pricing).

The fallback table is stamped with `PRICES_AS_OF` and that date is rendered
next to any figure derived from it. A hand-maintained price table goes stale —
the point is not to pretend otherwise but to make the staleness visible, so a
reader can judge the number instead of trusting it blindly.

A model absent from both sources yields `None`, and the UI shows measured
usage with the cost omitted. Never a wrong number.
"""
from __future__ import annotations

# Bump this whenever the table below is updated.
PRICES_AS_OF = "2026-08"

# USD per million tokens: model id -> (input, output).
# Only needed for providers that publish no pricing of their own.
_FALLBACK_PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    # Anthropic — https://platform.claude.com/docs/en/pricing
    "claude-opus-5": (5.00, 25.00),
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-opus-4-6": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-fable-5": (10.00, 50.00),
}


def fallback_price_per_token(model: str) -> tuple[float, float] | None:
    """(input, output) USD per *token* from the static table, or None.

    Matches on exact id first, then on a prefix so a dated snapshot
    (`claude-sonnet-4-6-20251114`) resolves to its alias entry.
    """
    entry = _FALLBACK_PRICES_PER_MTOK.get(model)
    if entry is None:
        for known, prices in _FALLBACK_PRICES_PER_MTOK.items():
            if model.startswith(known):
                entry = prices
                break
    if entry is None:
        return None
    return entry[0] / 1_000_000, entry[1] / 1_000_000


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    live_prices: dict[str, tuple[float, float]] | None = None,
) -> tuple[float, str] | None:
    """Estimated USD cost and the source that produced it.

    Returns `(cost, source)` where source is "provider" (live, current) or
    "table" (static, as of PRICES_AS_OF), or None when neither source knows
    this model — in which case the caller reports usage without a cost rather
    than inventing one.
    """
    if live_prices and model in live_prices:
        in_price, out_price = live_prices[model]
        source = "provider"
    else:
        prices = fallback_price_per_token(model)
        if prices is None:
            return None
        in_price, out_price = prices
        source = "table"

    return input_tokens * in_price + output_tokens * out_price, source
