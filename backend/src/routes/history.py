from __future__ import annotations

import json
from datetime import date

from litestar import Controller, get, post
from litestar.params import Parameter

from database.connection import SessionLocal
from database.models import FinancialSnapshot, AnalysisHistory

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai_engine"))

from context_builder import build_snapshot_data


def _snapshot_to_dict(s: FinancialSnapshot) -> dict:
    return {
        "id": s.id,
        "snapshot_date": s.snapshot_date.isoformat() if s.snapshot_date else None,
        "total_income": s.total_income,
        "total_expenses": s.total_expenses,
        "net_savings": s.net_savings,
        "savings_rate": s.savings_rate,
        "total_debt": s.total_debt,
        "total_savings": s.total_savings,
        "net_worth": s.net_worth,
        "details": s.details,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


class HistoryController(Controller):
    path = "/api/history"

    @get("/snapshots")
    async def list_snapshots(self) -> list[dict]:
        """List all financial snapshots."""
        db = SessionLocal()
        try:
            snapshots = (
                db.query(FinancialSnapshot)
                .order_by(FinancialSnapshot.snapshot_date.desc())
                .all()
            )
            return [_snapshot_to_dict(s) for s in snapshots]
        finally:
            db.close()

    @post("/snapshots")
    async def create_snapshot(self) -> dict:
        """Take a snapshot of the current financial state."""
        db = SessionLocal()
        try:
            data = build_snapshot_data(db)
            snapshot = FinancialSnapshot(
                snapshot_date=date.today(),
                **data,
            )
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
            return _snapshot_to_dict(snapshot)
        finally:
            db.close()

    @get("/snapshots/{snapshot_id:int}")
    async def get_snapshot(self, snapshot_id: int) -> dict:
        """Get a single snapshot by ID."""
        db = SessionLocal()
        try:
            snapshot = db.query(FinancialSnapshot).filter(FinancialSnapshot.id == snapshot_id).first()
            if not snapshot:
                return {"error": "Snapshot not found"}
            return _snapshot_to_dict(snapshot)
        finally:
            db.close()

    @get("/timeline")
    async def get_timeline(
        self,
        limit: int = Parameter(query="limit", default=20),
    ) -> list[dict]:
        """Get a combined timeline of snapshots and analyses."""
        db = SessionLocal()
        try:
            snapshots = (
                db.query(FinancialSnapshot)
                .order_by(FinancialSnapshot.created_at.desc())
                .limit(limit)
                .all()
            )
            analyses = (
                db.query(AnalysisHistory)
                .order_by(AnalysisHistory.created_at.desc())
                .limit(limit)
                .all()
            )

            timeline = []
            for s in snapshots:
                timeline.append({
                    "type": "snapshot",
                    "date": s.created_at.isoformat() if s.created_at else None,
                    "data": _snapshot_to_dict(s),
                })
            for a in analyses:
                timeline.append({
                    "type": "analysis",
                    "date": a.created_at.isoformat() if a.created_at else None,
                    "data": {
                        "id": a.id,
                        "analysis_type": a.analysis_type,
                        "prompt": a.prompt,
                        "response": a.response[:200] + "..." if len(a.response) > 200 else a.response,
                        "model_used": a.model_used,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    },
                })

            timeline.sort(key=lambda x: x["date"] or "", reverse=True)
            return timeline[:limit]
        finally:
            db.close()
