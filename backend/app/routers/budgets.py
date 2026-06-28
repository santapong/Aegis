from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models.budget import Budget
from ..models.transaction import Transaction, TransactionType
from ..models.trip import Trip
from ..models.user import User
from ..schemas.budget import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetComparison,
    BudgetComparisonResponse,
    BudgetTemplateListResponse,
    AdoptTemplateRequest,
    BUDGET_TEMPLATES,
    BUDGET_TEMPLATES_BY_KEY,
)
from ..auth import get_current_user
from ..cache import invalidate_user_all

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


def _validate_trip_ownership(db: Session, trip_id: str | None, user_id: str) -> None:
    if not trip_id:
        return
    exists = (
        db.query(Trip.id)
        .filter(Trip.id == trip_id, Trip.user_id == user_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Trip not found")


@router.post("/", response_model=BudgetResponse, status_code=201)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _validate_trip_ownership(db, budget.trip_id, current_user.id)
    db_budget = Budget(**budget.model_dump(), user_id=current_user.id)
    db.add(db_budget)
    db.commit()
    invalidate_user_all(current_user.id)
    db.refresh(db_budget)
    return db_budget


@router.get("/", response_model=list[BudgetResponse])
def list_budgets(
    category: str | None = None,
    active: bool | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Budget).filter(Budget.user_id == current_user.id)
    if category:
        query = query.filter(Budget.category == category)
    if active is True:
        today = date.today()
        query = query.filter(Budget.period_start <= today, Budget.period_end >= today)
    return (
        query.order_by(Budget.period_start.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/comparison", response_model=BudgetComparisonResponse)
def budget_comparison(
    period_start: date | None = None,
    period_end: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    if not period_start:
        period_start = today.replace(day=1)
    if not period_end:
        period_end = today

    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .filter(Budget.period_start <= period_end, Budget.period_end >= period_start)
        .all()
    )

    # Aggregate expense totals per category in a single GROUP BY query
    # instead of loading every expense row into Python and summing.
    # Rows returned: ≤ number-of-distinct-categories (typically 4-30),
    # regardless of how many transactions sit in the window. Was a
    # full-window scan on a hot path called by the dashboard.
    spent_rows = (
        db.query(
            Transaction.category,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= period_start,
            Transaction.date <= period_end,
        )
        .group_by(Transaction.category)
        .all()
    )
    spent_by_category: dict[str, float] = {
        cat: float(total or 0) for cat, total in spent_rows
    }

    comparisons = []
    for b in budgets:
        actual = spent_by_category.get(b.category, 0)
        remaining = float(b.amount) - actual
        usage = (actual / float(b.amount) * 100) if float(b.amount) > 0 else 0
        comparisons.append(
            BudgetComparison(
                category=b.category,
                budget_amount=float(b.amount),
                actual_spent=actual,
                remaining=remaining,
                usage_percent=round(usage, 1),
                over_budget=actual > float(b.amount),
            )
        )

    total_budgeted = sum(float(b.amount) for b in budgets)
    total_spent = sum(c.actual_spent for c in comparisons)

    return BudgetComparisonResponse(
        period_start=period_start,
        period_end=period_end,
        comparisons=comparisons,
        total_budgeted=total_budgeted,
        total_spent=total_spent,
    )


@router.get("/templates", response_model=BudgetTemplateListResponse)
def list_budget_templates(current_user: User = Depends(get_current_user)):
    """Return the predefined budget templates (50/30/20, zero-based).

    Auth-gated for parity with the rest of the router even though the
    catalog is static — keeps the client's auth pipeline uniform.
    """
    return BudgetTemplateListResponse(templates=BUDGET_TEMPLATES)


@router.post("/templates/{key}/adopt", response_model=list[BudgetResponse], status_code=201)
def adopt_budget_template(
    key: str,
    body: AdoptTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adopt a template: create one Budget row per template category for the
    current month, sized by ``monthly_income``.

    Idempotent — a row is matched on (user_id, category, period_start,
    period_end); an existing match is left untouched and returned as-is, so
    re-adopting the same template+period creates zero duplicates. The
    response is the full set of rows for the template this period (created +
    pre-existing), in template order.

    Idempotency is enforced at the application layer: a single existence
    query, then insert only the categories not already present. We
    deliberately do NOT add a DB unique constraint — it would regress the
    plain ``POST /api/budgets/`` endpoint (which allows multiple budgets per
    category/period) and collide personal vs. trip-scoped budgets, and a
    NULL-safe version isn't portable across the supported databases. The
    residual gap (two *simultaneous* adopts both passing the existence check)
    is a low-severity, self-correcting data-quality issue. See
    docs/design/005-budget-templates.md, Decision 2.
    """
    template = BUDGET_TEMPLATES_BY_KEY.get(key)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    today = date.today()
    period_start = today.replace(day=1)
    # Last day of the current month: jump to the 1st of next month, step back.
    if today.month == 12:
        next_month_first = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month_first = today.replace(month=today.month + 1, day=1)
    period_end = next_month_first - timedelta(days=1)

    categories = [c.category for c in template.categories]

    def _existing_by_category() -> dict[str, Budget]:
        """Current rows for this user/period in the template's categories."""
        return {
            b.category: b
            for b in db.query(Budget)
            .filter(
                Budget.user_id == current_user.id,
                Budget.category.in_(categories),
                Budget.period_start == period_start,
                Budget.period_end == period_end,
            )
            .all()
        }

    # Fast path: skip categories that already exist so a re-adopt / double-
    # click maps to an existence check rather than a duplicate insert.
    existing = _existing_by_category()
    created_any = False
    for cat in template.categories:
        if cat.category in existing:
            continue
        db.add(
            Budget(
                user_id=current_user.id,
                name=f"{template.name} — {cat.category}",
                amount=round(body.monthly_income * cat.pct, 2),
                category=cat.category,
                period_start=period_start,
                period_end=period_end,
            )
        )
        created_any = True

    if created_any:
        db.commit()
        invalidate_user_all(current_user.id)

    # Re-read so the response reflects the committed state (ours + any rows a
    # racing request created), returned in template order.
    final = _existing_by_category()
    return [final[c.category] for c in template.categories if c.category in final]


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(budget_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(budget_id: str, data: BudgetUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    update_data = data.model_dump(exclude_unset=True)
    if "trip_id" in update_data:
        _validate_trip_ownership(db, update_data["trip_id"], current_user.id)
    for key, val in update_data.items():
        setattr(budget, key, val)
    db.commit()
    invalidate_user_all(current_user.id)
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    invalidate_user_all(current_user.id)
