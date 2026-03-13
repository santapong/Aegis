from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.ai_recommendation import AIRecommendation
from ..schemas.ai import AIAnalyzeRequest, AIRecommendationResponse, AIForecastResponse
from ..services.ai_engine import AIEngine

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze", response_model=list[AIRecommendationResponse])
def analyze_finances(request: AIAnalyzeRequest, db: Session = Depends(get_db)):
    engine = AIEngine(db)
    recommendations = engine.analyze(
        question=request.question,
        days=request.date_range_days,
    )
    return recommendations


@router.post("/recommend", response_model=list[AIRecommendationResponse])
def get_recommendations(db: Session = Depends(get_db)):
    engine = AIEngine(db)
    return engine.analyze()


@router.post("/forecast", response_model=AIForecastResponse)
def forecast_finances(
    months: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db),
):
    engine = AIEngine(db)
    return engine.forecast(months_ahead=months)


@router.get("/history", response_model=list[AIRecommendationResponse])
def get_ai_history(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
):
    return (
        db.query(AIRecommendation)
        .order_by(AIRecommendation.created_at.desc())
        .limit(limit)
        .all()
    )


@router.patch("/history/{rec_id}/accept")
def accept_recommendation(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(AIRecommendation).filter(AIRecommendation.id == rec_id).first()
    if rec:
        rec.accepted = True
        db.commit()
    return {"status": "ok"}
