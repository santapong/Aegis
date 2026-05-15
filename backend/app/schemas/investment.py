from datetime import datetime
from pydantic import BaseModel, Field


class InvestmentCreate(BaseModel):
    name: str = Field(..., max_length=255)
    tradingview_symbol: str = Field(..., max_length=64)
    units: float = Field(..., ge=0)
    cost_basis: float = Field(default=0, ge=0)
    current_price: float = Field(default=0, ge=0)
    currency: str = Field(default="USD", max_length=8)
    notes: str | None = None


class InvestmentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    tradingview_symbol: str | None = Field(default=None, max_length=64)
    units: float | None = Field(default=None, ge=0)
    cost_basis: float | None = Field(default=None, ge=0)
    current_price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=8)
    notes: str | None = None


class InvestmentResponse(BaseModel):
    id: str
    name: str
    tradingview_symbol: str
    units: float
    cost_basis: float
    current_price: float
    currency: str
    notes: str | None
    last_priced_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HoldingSummary(BaseModel):
    id: str
    name: str
    tradingview_symbol: str
    units: float
    cost_basis: float
    current_value: float
    pl: float
    pl_percent: float


class PortfolioSummary(BaseModel):
    total_cost_basis: float
    total_current_value: float
    total_pl: float
    total_pl_percent: float
    holding_count: int
    by_holding: list[HoldingSummary]
