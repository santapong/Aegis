from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from ..database import get_db
from ..models.plan import Plan
from ..schemas.plan import GanttTask

router = APIRouter(prefix="/api/gantt", tags=["gantt"])


@router.get("/tasks", response_model=list[GanttTask])
def get_gantt_tasks(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Plan).filter(Plan.end_date.isnot(None))
    if start:
        query = query.filter(Plan.start_date >= start)
    if end:
        query = query.filter(Plan.end_date <= end)

    plans = query.order_by(Plan.start_date).all()
    return [
        GanttTask(
            id=p.id,
            title=p.title,
            start=p.start_date,
            end=p.end_date,
            progress=p.progress,
            parent_id=p.parent_id,
            color=p.color,
            priority=p.priority,
            status=p.status,
        )
        for p in plans
    ]


@router.put("/tasks/{task_id}")
def update_gantt_task(
    task_id: str,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    progress: int | None = Query(default=None, ge=0, le=100),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == task_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Task not found")
    if start:
        plan.start_date = start
    if end:
        plan.end_date = end
    if progress is not None:
        plan.progress = progress
    db.commit()
    db.refresh(plan)
    return {"status": "ok", "id": plan.id}
