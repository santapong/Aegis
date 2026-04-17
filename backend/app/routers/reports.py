import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models.transaction import Transaction, TransactionType
from ..models.user import User
from ..auth import get_current_user
from ..services.pdf_renderer import render_report_pdf


router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/category-comparison")
def category_comparison(
    months: int = Query(default=6, ge=2, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    result: list[dict] = []

    for i in range(months - 1, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year - (1 if today.month - i <= 0 else 0)
        month_start = date(y, m, 1)
        if m == 12:
            month_end = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(y, m + 1, 1) - timedelta(days=1)

        expenses = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.type == TransactionType.expense,
                Transaction.date >= month_start,
                Transaction.date <= month_end,
            )
            .all()
        )

        month_data: dict[str, float] = {}
        for t in expenses:
            month_data[t.category] = month_data.get(t.category, 0) + float(t.amount)

        result.append({
            "month": month_start.strftime("%b %Y"),
            "categories": month_data,
        })

    for i in range(1, len(result)):
        changes: dict[str, float | None] = {}
        for cat in set(list(result[i]["categories"].keys()) + list(result[i - 1]["categories"].keys())):
            prev = result[i - 1]["categories"].get(cat, 0)
            curr = result[i]["categories"].get(cat, 0)
            if prev > 0:
                changes[cat] = round((curr - prev) / prev * 100, 1)
            elif curr > 0:
                changes[cat] = None
            else:
                changes[cat] = 0.0
        result[i]["changes"] = changes
    if result:
        result[0]["changes"] = {}

    return result


@router.get("/export")
def export_csv(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    transactions = query.order_by(Transaction.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Amount", "Description"])
    for t in transactions:
        writer.writerow([
            t.date.isoformat(),
            t.type.value,
            t.category,
            float(t.amount),
            t.description or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/export.pdf")
def export_pdf(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Render the reports view to a formatted PDF via WeasyPrint."""
    today = date.today()
    start = start_date or today.replace(day=1)
    end = end_date or today

    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start,
        Transaction.date <= end,
    )
    transactions = query.all()

    total_income = sum(float(t.amount) for t in transactions if t.type == TransactionType.income)
    total_expenses = sum(float(t.amount) for t in transactions if t.type == TransactionType.expense)

    by_category: dict[str, float] = {}
    for t in transactions:
        if t.type == TransactionType.expense:
            by_category[t.category] = by_category.get(t.category, 0) + float(t.amount)
    by_category = dict(sorted(by_category.items(), key=lambda kv: kv[1], reverse=True))

    pdf_bytes = render_report_pdf(
        username=current_user.username,
        start=start,
        end=end,
        total_income=total_income,
        total_expenses=total_expenses,
        by_category=by_category,
    )

    filename = f"aegis-report-{start.strftime('%Y%m%d')}-{end.strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
