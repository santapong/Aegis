from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from ..database import get_db
from ..models.transaction import Transaction, TransactionType
from ..schemas.transaction import TransactionCreate, TransactionResponse, TransactionSummary
from ..schemas.dashboard import AnomalyItem, AnomaliesResponse

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(txn: TransactionCreate, db: Session = Depends(get_db)):
    db_txn = Transaction(**txn.model_dump())
    db.add(db_txn)
    db.commit()
    db.refresh(db_txn)
    return db_txn


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    type: TransactionType | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if type:
        query = query.filter(Transaction.type == type)
    if category:
        query = query.filter(Transaction.category == category)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=TransactionSummary)
def transaction_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    transactions = query.all()
    total_income = sum(float(t.amount) for t in transactions if t.type == TransactionType.income)
    total_expenses = sum(float(t.amount) for t in transactions if t.type == TransactionType.expense)

    by_category: dict[str, float] = {}
    for t in transactions:
        by_category[t.category] = by_category.get(t.category, 0) + float(t.amount)

    return TransactionSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net=total_income - total_expenses,
        by_category=by_category,
        count=len(transactions),
    )


@router.get("/anomalies", response_model=AnomaliesResponse)
def detect_anomalies(
    days: int = Query(default=90, ge=7, le=365),
    threshold: float = Query(default=2.0, ge=1.5),
    db: Session = Depends(get_db),
):
    today = date.today()
    start = today - timedelta(days=days)

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.type == TransactionType.expense,
            Transaction.date >= start,
        )
        .order_by(Transaction.date.desc())
        .all()
    )

    # Calculate average per category
    cat_totals: dict[str, list[float]] = {}
    for t in expenses:
        cat_totals.setdefault(t.category, []).append(float(t.amount))

    cat_avg = {cat: sum(vals) / len(vals) for cat, vals in cat_totals.items()}

    anomalies = []
    for t in expenses:
        avg = cat_avg.get(t.category, 0)
        if avg > 0 and float(t.amount) > avg * threshold:
            anomalies.append(
                AnomalyItem(
                    transaction_id=t.id,
                    date=t.date.isoformat(),
                    category=t.category,
                    amount=float(t.amount),
                    average_for_category=round(avg, 2),
                    deviation_ratio=round(float(t.amount) / avg, 2),
                    description=t.description,
                )
            )

    anomalies.sort(key=lambda a: a.deviation_ratio, reverse=True)

    return AnomaliesResponse(anomalies=anomalies, total_count=len(anomalies))


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: str, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
