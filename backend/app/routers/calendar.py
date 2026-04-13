from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from ..database import get_db
from ..models.plan import Plan
from ..models.user import User
from ..schemas.plan import CalendarEvent
from ..auth import get_current_user

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events", response_model=list[CalendarEvent])
def get_calendar_events(
    start: date = Query(...),
    end: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plans = (
        db.query(Plan)
        .filter(Plan.user_id == current_user.id)
        .filter(Plan.start_date <= end)
        .filter((Plan.end_date >= start) | (Plan.end_date.is_(None)))
        .order_by(Plan.start_date)
        .all()
    )
    return [
        CalendarEvent(
            id=p.id,
            title=p.title,
            start=p.start_date,
            end=p.end_date,
            color=p.color,
            category=p.category,
            status=p.status,
            amount=float(p.amount),
        )
        for p in plans
    ]


@router.put("/events/{event_id}/move")
def move_event(
    event_id: str,
    new_start: date = Query(...),
    new_end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(Plan).filter(Plan.id == event_id, Plan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Event not found")
    plan.start_date = new_start
    if new_end:
        plan.end_date = new_end
    db.commit()
    db.refresh(plan)
    return {"status": "ok", "id": plan.id}
