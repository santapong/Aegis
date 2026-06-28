from datetime import date, datetime
from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    name: str = Field(..., max_length=255)
    amount: float = Field(..., gt=0)
    category: str = Field(..., max_length=100)
    period_start: date
    period_end: date
    trip_id: str | None = None


class BudgetUpdate(BaseModel):
    name: str | None = None
    amount: float | None = Field(default=None, gt=0)
    category: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    trip_id: str | None = None


class BudgetResponse(BaseModel):
    id: str
    name: str
    amount: float
    spent: float
    category: str
    period_start: date
    period_end: date
    created_at: datetime
    trip_id: str | None = None

    model_config = {"from_attributes": True}


class BudgetComparison(BaseModel):
    category: str
    budget_amount: float
    actual_spent: float
    remaining: float
    usage_percent: float
    over_budget: bool


class BudgetComparisonResponse(BaseModel):
    period_start: date
    period_end: date
    comparisons: list[BudgetComparison]
    total_budgeted: float
    total_spent: float


# ---------------------------------------------------------------------------
# Budget templates — predefined category/percentage splits a user can adopt
# in one click. Amounts are derived at adoption time from the supplied
# monthly income, so the catalog itself only carries the percentage shape.
# ---------------------------------------------------------------------------


class BudgetTemplateCategory(BaseModel):
    """One line of a template: which category and what share of income.

    ``category`` is always a real Aegis spend category (the same strings
    transactions are tagged with — see ``seeds/demo.py`` /
    ``routers/dashboard.py``), so an adopted budget actually compares
    against spend in ``GET /api/budgets/comparison`` instead of reading
    $0 forever. ``tier`` is an optional grouping label (needs / wants /
    savings) the 50/30/20 template uses to keep the rule recognizable in
    the UI; it carries no behavior."""

    category: str
    # Share of monthly income, 0..1 (e.g. 0.5 == 50%).
    pct: float = Field(..., gt=0, le=1)
    tier: str | None = None


class BudgetTemplate(BaseModel):
    key: str
    name: str
    description: str
    categories: list[BudgetTemplateCategory]


class BudgetTemplateListResponse(BaseModel):
    templates: list[BudgetTemplate]


class AdoptTemplateRequest(BaseModel):
    """Body for adopting a template. ``monthly_income`` is the source of
    truth for the amounts; each category's amount is
    ``round(monthly_income * pct, 2)``."""

    monthly_income: float = Field(..., gt=0)


# Real Aegis spend categories — the strings transactions are actually tagged
# with (seeds/demo.py EXPENSE_CATEGORIES + dashboard CATEGORY_COLORS, plus
# `savings`, the allocation sink). Templates may ONLY allocate to these, so an
# adopted budget joins to real spend in GET /api/budgets/comparison (which
# matches budget.category to Transaction.category by strict equality) instead
# of reading $0 / 0% forever. Guarded at import below.
KNOWN_BUDGET_CATEGORIES: frozenset[str] = frozenset(
    {
        "groceries",
        "rent",
        "utilities",
        "dining",
        "transport",
        "subscriptions",
        "entertainment",
        "health",
        "shopping",
        # `savings` is intentional and inherently un-tracked: it's a transfer,
        # not an expense, so it has no matching expense transactions and a
        # savings budget reads as a target (0% "spent"), by design. Documented
        # in docs/design/005-budget-templates.md.
        "savings",
    }
)

# Catalog. Two invariants, both guarded at import (so a bad edit fails fast on
# load, not in a request): percentages sum to exactly 1.0 per template, and
# every category is a real Aegis category. The 50/30/20 rule is expressed as a
# concrete distribution over real categories grouped into needs/wants/savings
# tiers (needs sum to 50%, wants to 30%, savings to 20%) so the rule stays
# recognizable while every row still tracks real spend. The zero-based split
# gives every dollar a job across the same real categories.
BUDGET_TEMPLATES: list[BudgetTemplate] = [
    BudgetTemplate(
        key="50-30-20",
        name="50/30/20 Rule",
        description="50% needs, 30% wants, 20% savings — mapped onto your real "
        "spend categories so each budget tracks actual spending.",
        categories=[
            # Needs — 50%
            BudgetTemplateCategory(category="rent", pct=0.30, tier="needs"),
            BudgetTemplateCategory(category="groceries", pct=0.10, tier="needs"),
            BudgetTemplateCategory(category="utilities", pct=0.06, tier="needs"),
            BudgetTemplateCategory(category="transport", pct=0.04, tier="needs"),
            # Wants — 30%
            BudgetTemplateCategory(category="dining", pct=0.10, tier="wants"),
            BudgetTemplateCategory(category="entertainment", pct=0.08, tier="wants"),
            BudgetTemplateCategory(category="shopping", pct=0.07, tier="wants"),
            BudgetTemplateCategory(category="subscriptions", pct=0.05, tier="wants"),
            # Savings — 20%
            BudgetTemplateCategory(category="savings", pct=0.20, tier="savings"),
        ],
    ),
    BudgetTemplate(
        key="zero-based",
        name="Zero-Based Budget",
        description="Give every dollar a job across rent, groceries, transport, "
        "savings and the rest — income minus allocations equals zero.",
        categories=[
            BudgetTemplateCategory(category="rent", pct=0.28),
            BudgetTemplateCategory(category="groceries", pct=0.12),
            BudgetTemplateCategory(category="dining", pct=0.08),
            BudgetTemplateCategory(category="transport", pct=0.08),
            BudgetTemplateCategory(category="utilities", pct=0.07),
            BudgetTemplateCategory(category="subscriptions", pct=0.03),
            BudgetTemplateCategory(category="entertainment", pct=0.06),
            BudgetTemplateCategory(category="health", pct=0.05),
            BudgetTemplateCategory(category="shopping", pct=0.08),
            BudgetTemplateCategory(category="savings", pct=0.15),
        ],
    ),
]

BUDGET_TEMPLATES_BY_KEY: dict[str, BudgetTemplate] = {
    t.key: t for t in BUDGET_TEMPLATES
}

# Fail fast on a catalog typo: every template allocates exactly 100% of income
# to real, trackable Aegis categories (no duplicate category within a template).
for _t in BUDGET_TEMPLATES:
    _total = round(sum(c.pct for c in _t.categories), 6)
    assert _total == 1.0, f"Template {_t.key!r} percentages sum to {_total}, expected 1.0"
    _cats = [c.category for c in _t.categories]
    assert len(_cats) == len(set(_cats)), f"Template {_t.key!r} has a duplicate category"
    _unknown = set(_cats) - KNOWN_BUDGET_CATEGORIES
    assert not _unknown, f"Template {_t.key!r} uses unknown categories: {sorted(_unknown)}"
