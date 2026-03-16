from __future__ import annotations

from datetime import date
from typing import Optional

from litestar import Controller, get, post, put, delete
from pydantic import BaseModel

from database.connection import SessionLocal
from database.models import SavingsJar


class SavingsJarCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: float = 0.0
    icon: str = "jar"
    color: str = "#10b981"
    deadline: Optional[date] = None
    auto_save_amount: float = 0.0
    auto_save_frequency: Optional[str] = None


class SavingsJarUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    deadline: Optional[date] = None
    auto_save_amount: Optional[float] = None
    auto_save_frequency: Optional[str] = None


class SavingsTransaction(BaseModel):
    amount: float


def _jar_to_dict(jar: SavingsJar) -> dict:
    return {
        "id": jar.id,
        "name": jar.name,
        "target_amount": jar.target_amount,
        "current_amount": jar.current_amount,
        "icon": jar.icon,
        "color": jar.color,
        "deadline": jar.deadline.isoformat() if jar.deadline else None,
        "auto_save_amount": jar.auto_save_amount,
        "auto_save_frequency": jar.auto_save_frequency,
        "created_at": jar.created_at.isoformat() if jar.created_at else None,
    }


class SavingsController(Controller):
    path = "/api/savings"

    @get("/")
    async def list_jars(self) -> list[dict]:
        db = SessionLocal()
        try:
            jars = db.query(SavingsJar).order_by(SavingsJar.id.desc()).all()
            return [_jar_to_dict(j) for j in jars]
        finally:
            db.close()

    @post("/")
    async def create_jar(self, data: SavingsJarCreate) -> dict:
        db = SessionLocal()
        try:
            jar = SavingsJar(
                name=data.name,
                target_amount=data.target_amount,
                current_amount=data.current_amount,
                icon=data.icon,
                color=data.color,
                deadline=data.deadline,
                auto_save_amount=data.auto_save_amount,
                auto_save_frequency=data.auto_save_frequency,
            )
            db.add(jar)
            db.commit()
            db.refresh(jar)
            return _jar_to_dict(jar)
        finally:
            db.close()

    @get("/{jar_id:int}")
    async def get_jar(self, jar_id: int) -> dict:
        db = SessionLocal()
        try:
            jar = db.query(SavingsJar).filter(SavingsJar.id == jar_id).first()
            if not jar:
                return {"error": "Jar not found"}
            return _jar_to_dict(jar)
        finally:
            db.close()

    @put("/{jar_id:int}")
    async def update_jar(self, jar_id: int, data: SavingsJarUpdate) -> dict:
        db = SessionLocal()
        try:
            jar = db.query(SavingsJar).filter(SavingsJar.id == jar_id).first()
            if not jar:
                return {"error": "Jar not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(jar, field, value)
            db.commit()
            db.refresh(jar)
            return _jar_to_dict(jar)
        finally:
            db.close()

    @delete("/{jar_id:int}", status_code=200)
    async def delete_jar(self, jar_id: int) -> dict:
        db = SessionLocal()
        try:
            jar = db.query(SavingsJar).filter(SavingsJar.id == jar_id).first()
            if not jar:
                return {"error": "Jar not found"}
            db.delete(jar)
            db.commit()
            return {"message": "Jar deleted"}
        finally:
            db.close()

    @post("/{jar_id:int}/deposit")
    async def deposit(self, jar_id: int, data: SavingsTransaction) -> dict:
        db = SessionLocal()
        try:
            jar = db.query(SavingsJar).filter(SavingsJar.id == jar_id).first()
            if not jar:
                return {"error": "Jar not found"}
            jar.current_amount = jar.current_amount + data.amount
            db.commit()
            db.refresh(jar)
            return _jar_to_dict(jar)
        finally:
            db.close()

    @post("/{jar_id:int}/withdraw")
    async def withdraw(self, jar_id: int, data: SavingsTransaction) -> dict:
        db = SessionLocal()
        try:
            jar = db.query(SavingsJar).filter(SavingsJar.id == jar_id).first()
            if not jar:
                return {"error": "Jar not found"}
            if data.amount > jar.current_amount:
                return {"error": "Insufficient funds"}
            jar.current_amount = jar.current_amount - data.amount
            db.commit()
            db.refresh(jar)
            return _jar_to_dict(jar)
        finally:
            db.close()

    @get("/summary")
    async def get_summary(self) -> dict:
        db = SessionLocal()
        try:
            jars = db.query(SavingsJar).all()

            total_saved = sum(j.current_amount for j in jars)
            total_target = sum(j.target_amount for j in jars)
            overall_progress = (total_saved / total_target * 100) if total_target > 0 else 0.0

            deadlines = [j.deadline for j in jars if j.deadline is not None]
            nearest_deadline = min(deadlines).isoformat() if deadlines else None

            return {
                "total_saved": total_saved,
                "total_target": total_target,
                "overall_progress": round(overall_progress, 1),
                "jar_count": len(jars),
                "nearest_deadline": nearest_deadline,
            }
        finally:
            db.close()
