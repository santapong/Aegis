"""Pydantic schemas for the user preferences endpoint.

Field names use snake_case on the wire to match the rest of the API. The
frontend translates these into its camelCase `AppSettings` shape.
"""
from pydantic import BaseModel, Field


class UserPreferencesResponse(BaseModel):
    currency: str
    default_date_range_days: int
    items_per_page: int
    ai_auto_suggestions: bool
    # None means "follow the env default" — the settings UI renders that as
    # the provider's configured model with a "default" affordance.
    ai_model: str | None = None

    model_config = {"from_attributes": True}


class UserPreferencesUpdate(BaseModel):
    """Partial update payload — every field optional so PUT can patch one key
    at a time without requiring the client to re-send the whole shape."""

    currency: str | None = Field(default=None, max_length=8)
    default_date_range_days: int | None = Field(default=None, ge=1, le=3650)
    items_per_page: int | None = Field(default=None, ge=1, le=500)
    ai_auto_suggestions: bool | None = None
    # Sent as "" to clear the override and fall back to the env default;
    # the router normalises "" -> None so the client doesn't have to send
    # an explicit JSON null.
    ai_model: str | None = Field(default=None, max_length=128)
