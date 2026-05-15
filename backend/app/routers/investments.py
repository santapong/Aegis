from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.investment import Investment
from ..models.user import User
from ..schemas.investment import (
    HoldingSummary,
    InvestmentCreate,
    InvestmentResponse,
    InvestmentUpdate,
    PortfolioSummary,
)

router = APIRouter(prefix="/api/investments", tags=["investments"])


@router.get("/", response_model=list[InvestmentResponse])
def list_investments(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Investment)
        .filter(Investment.user_id == current_user.id)
        .order_by(Investment.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/", response_model=InvestmentResponse, status_code=201)
def create_investment(
    payload: InvestmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = Investment(
        **payload.model_dump(),
        user_id=current_user.id,
        last_priced_at=datetime.utcnow() if payload.current_price else None,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/summary", response_model=PortfolioSummary)
def portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holdings = (
        db.query(Investment).filter(Investment.user_id == current_user.id).all()
    )
    by_holding: list[HoldingSummary] = []
    total_cost = 0.0
    total_value = 0.0
    for h in holdings:
        cost = float(h.cost_basis)
        value = float(h.units) * float(h.current_price)
        pl = value - cost
        pl_pct = (pl / cost * 100.0) if cost > 0 else 0.0
        total_cost += cost
        total_value += value
        by_holding.append(
            HoldingSummary(
                id=h.id,
                name=h.name,
                tradingview_symbol=h.tradingview_symbol,
                units=float(h.units),
                cost_basis=cost,
                current_value=round(value, 2),
                pl=round(pl, 2),
                pl_percent=round(pl_pct, 2),
            )
        )
    total_pl = total_value - total_cost
    total_pl_pct = (total_pl / total_cost * 100.0) if total_cost > 0 else 0.0
    return PortfolioSummary(
        total_cost_basis=round(total_cost, 2),
        total_current_value=round(total_value, 2),
        total_pl=round(total_pl, 2),
        total_pl_percent=round(total_pl_pct, 2),
        holding_count=len(holdings),
        by_holding=by_holding,
    )


@router.get("/{inv_id}", response_model=InvestmentResponse)
def get_investment(
    inv_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Investment)
        .filter(Investment.id == inv_id, Investment.user_id == current_user.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    return inv


@router.patch("/{inv_id}", response_model=InvestmentResponse)
def update_investment(
    inv_id: str,
    update: InvestmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Investment)
        .filter(Investment.id == inv_id, Investment.user_id == current_user.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    data = update.model_dump(exclude_unset=True)
    if "current_price" in data:
        inv.last_priced_at = datetime.utcnow()
    for k, v in data.items():
        setattr(inv, k, v)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{inv_id}", status_code=204)
def delete_investment(
    inv_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = (
        db.query(Investment)
        .filter(Investment.id == inv_id, Investment.user_id == current_user.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    db.delete(inv)
    db.commit()
