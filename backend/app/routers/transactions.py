from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import date, timedelta
import io
import pandas as pd

from ..database import get_db
from ..models.transaction import Transaction, TransactionType, RecurringInterval
from ..models.tag import Tag
from ..models.user import User
from ..schemas.transaction import (
    TransactionCreate, TransactionUpdate, TransactionResponse, TransactionSummary,
    RecurringTransactionSummary,
    TagCreate, TagUpdate, TagResponse,
    ImportPreviewResponse, ImportPreviewRow, ImportConfirmRequest, ImportResultResponse,
)
from ..schemas.dashboard import AnomalyItem, AnomaliesResponse
from ..services.notification_service import evaluate_budget_thresholds
from ..auth import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(txn: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag_ids = txn.tag_ids
    data = txn.model_dump(exclude={"tag_ids"})
    db_txn = Transaction(**data, user_id=current_user.id)

    if tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        db_txn.tags = tags

    db.add(db_txn)
    db.commit()
    db.refresh(db_txn)
    evaluate_budget_thresholds(db, user_id=current_user.id, transaction=db_txn)
    return db_txn


@router.put("/{txn_id}", response_model=TransactionResponse)
def update_transaction(
    txn_id: str,
    update: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_txn = (
        db.query(Transaction)
        .filter(Transaction.id == txn_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not db_txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    data = update.model_dump(exclude_unset=True)
    tag_ids = data.pop("tag_ids", None)
    for key, val in data.items():
        setattr(db_txn, key, val)
    if tag_ids is not None:
        db_txn.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all() if tag_ids else []

    db.commit()
    db.refresh(db_txn)
    evaluate_budget_thresholds(db, user_id=current_user.id, transaction=db_txn)
    return db_txn


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    type: TransactionType | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    tags: str | None = Query(default=None, description="Comma-separated tag names"),
    q: str | None = Query(default=None, description="Free-text search over description + category"),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if type:
        query = query.filter(Transaction.type == type)
    if category:
        query = query.filter(Transaction.category == category)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if tags:
        tag_names = [t.strip() for t in tags.split(",")]
        query = query.filter(Transaction.tags.any(Tag.name.in_(tag_names)))
    if q:
        needle = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Transaction.description.ilike(needle),
                Transaction.category.ilike(needle),
            )
        )
    return query.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=TransactionSummary)
def transaction_summary(
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


@router.get("/recurring", response_model=RecurringTransactionSummary)
def get_recurring_transactions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recurring = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.is_recurring == True)
        .order_by(Transaction.next_due_date.asc())
        .all()
    )

    recurring_income = sum(float(t.amount) for t in recurring if t.type == TransactionType.income)
    recurring_expenses = sum(float(t.amount) for t in recurring if t.type == TransactionType.expense)

    def to_monthly(amount: float, interval: RecurringInterval | None) -> float:
        if not interval:
            return amount
        multipliers = {
            RecurringInterval.weekly: 4.33,
            RecurringInterval.biweekly: 2.17,
            RecurringInterval.monthly: 1.0,
            RecurringInterval.quarterly: 1 / 3,
            RecurringInterval.yearly: 1 / 12,
        }
        return amount * multipliers.get(interval, 1.0)

    total_monthly = sum(to_monthly(float(t.amount), t.recurring_interval) for t in recurring if t.type == TransactionType.expense)

    return RecurringTransactionSummary(
        total_monthly_recurring=round(total_monthly, 2),
        recurring_income=recurring_income,
        recurring_expenses=recurring_expenses,
        subscriptions=recurring,
    )


@router.get("/anomalies", response_model=AnomaliesResponse)
def detect_anomalies(
    days: int = Query(default=90, ge=7, le=365),
    threshold: float = Query(default=2.0, ge=1.5),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    start = today - timedelta(days=days)

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= start,
        )
        .order_by(Transaction.date.desc())
        .all()
    )

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


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    if file.content_type and file.content_type not in ("text/csv", "application/vnd.ms-excel", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV files are supported")

    content = await file.read()

    max_size = 5 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB")
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to parse CSV file")

    col_map = {}
    for col in df.columns:
        lower = col.lower().strip()
        if lower in ("date", "transaction date", "trans date"):
            col_map["date"] = col
        elif lower in ("description", "memo", "note", "details", "narrative"):
            col_map["description"] = col
        elif lower in ("amount", "value", "sum", "total"):
            col_map["amount"] = col
        elif lower in ("type", "transaction type", "dr/cr"):
            col_map["type"] = col
        elif lower in ("category", "tag", "label"):
            col_map["category"] = col

    if "amount" not in col_map:
        for col in df.columns:
            lower = col.lower().strip()
            if lower in ("debit", "withdrawal"):
                col_map["debit"] = col
            elif lower in ("credit", "deposit"):
                col_map["credit"] = col

    rows = []
    for _, row in df.iterrows():
        try:
            if "amount" in col_map:
                amount = abs(float(str(row[col_map["amount"]]).replace(",", "").replace("$", "")))
                raw_amount = float(str(row[col_map["amount"]]).replace(",", "").replace("$", ""))
                txn_type = "income" if raw_amount > 0 else "expense"
            elif "debit" in col_map or "credit" in col_map:
                debit = float(str(row.get(col_map.get("debit", ""), 0) or 0).replace(",", "").replace("$", ""))
                credit = float(str(row.get(col_map.get("credit", ""), 0) or 0).replace(",", "").replace("$", ""))
                amount = debit or credit
                txn_type = "income" if credit > 0 else "expense"
            else:
                continue

            if col_map.get("type"):
                type_val = str(row[col_map["type"]]).lower()
                if type_val in ("credit", "cr", "income", "deposit"):
                    txn_type = "income"
                else:
                    txn_type = "expense"

            rows.append(ImportPreviewRow(
                date=str(row.get(col_map.get("date", ""), date.today().isoformat())),
                description=str(row.get(col_map.get("description", ""), "")) or None,
                amount=round(amount, 2),
                type=txn_type,
                category=str(row.get(col_map.get("category", ""), "uncategorized")) or "uncategorized",
            ))
        except (ValueError, KeyError):
            continue

    return ImportPreviewResponse(
        rows=rows,
        total_rows=len(df),
        valid_rows=len(rows),
    )


@router.post("/import/confirm", response_model=ImportResultResponse)
def import_confirm(request: ImportConfirmRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    imported = 0
    errors = []

    for i, row in enumerate(request.rows):
        try:
            txn = Transaction(
                amount=row.amount,
                type=TransactionType(row.type),
                category=row.category,
                date=date.fromisoformat(row.date),
                description=row.description,
                user_id=current_user.id,
            )
            db.add(txn)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i + 1}: {str(e)}")

    db.commit()
    return ImportResultResponse(
        imported=imported,
        skipped=len(request.rows) - imported,
        errors=errors,
    )


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()


tags_router = APIRouter(prefix="/api/tags", tags=["tags"])


@tags_router.get("/", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Tag).filter(Tag.user_id == current_user.id).order_by(Tag.name).all()


@tags_router.post("/", response_model=TagResponse, status_code=201)
def create_tag(tag: TagCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Tag).filter(Tag.name == tag.name, Tag.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag already exists")
    db_tag = Tag(**tag.model_dump(), user_id=current_user.id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


@tags_router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: str, update: TagUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(tag, key, val)
    db.commit()
    db.refresh(tag)
    return tag


@tags_router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
