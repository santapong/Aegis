from __future__ import annotations

import json
import uuid
from typing import Optional

from litestar import Controller, get, post
from litestar.params import Parameter
from pydantic import BaseModel

from database.connection import SessionLocal
from database.models import AnalysisHistory, ChatMessage

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai_engine"))

from agent import AdvisorAgent
from context_builder import build_financial_context


advisor = AdvisorAgent()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class AnalyzeRequest(BaseModel):
    custom_prompt: Optional[str] = None


def _analysis_to_dict(a: AnalysisHistory) -> dict:
    return {
        "id": a.id,
        "analysis_type": a.analysis_type,
        "prompt": a.prompt,
        "response": a.response,
        "financial_summary": a.financial_summary,
        "model_used": a.model_used,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _message_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "session_id": m.session_id,
        "role": m.role,
        "content": m.content,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


class AIController(Controller):
    path = "/api/ai"

    @post("/analyze")
    async def analyze_finances(self, data: AnalyzeRequest) -> dict:
        """Run a full AI financial analysis."""
        db = SessionLocal()
        try:
            financial_data = build_financial_context(db)

            try:
                response = advisor.analyze_finances(financial_data)
            except Exception as e:
                return {"error": f"AI service unavailable: {str(e)}",
                        "hint": "Ensure Ollama is running with a Qwen model: ollama pull qwen2.5:7b && ollama serve"}

            analysis = AnalysisHistory(
                analysis_type="full_analysis",
                prompt=data.custom_prompt or "Full financial analysis",
                response=response,
                financial_summary=json.dumps(financial_data),
                model_used=advisor.model,
            )
            db.add(analysis)
            db.commit()
            db.refresh(analysis)

            return _analysis_to_dict(analysis)
        finally:
            db.close()

    @post("/chat")
    async def chat(self, data: ChatRequest) -> dict:
        """Send a chat message and get AI response."""
        db = SessionLocal()
        try:
            session_id = data.session_id or str(uuid.uuid4())
            financial_data = build_financial_context(db)

            # Get conversation history for this session
            history = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc())
                .all()
            )

            messages = [{"role": m.role, "content": m.content} for m in history]
            messages.append({"role": "user", "content": data.message})

            try:
                response = advisor.chat(messages=messages, financial_context=financial_data)
            except Exception as e:
                return {"error": f"AI service unavailable: {str(e)}",
                        "hint": "Ensure Ollama is running with a Qwen model: ollama pull qwen2.5:7b && ollama serve"}

            # Save user message
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=data.message,
            )
            db.add(user_msg)

            # Save assistant response
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=response,
            )
            db.add(assistant_msg)
            db.commit()

            return {
                "session_id": session_id,
                "response": response,
                "message_count": len(history) + 2,
            }
        finally:
            db.close()

    @get("/chat/history")
    async def get_chat_history(
        self,
        session_id: str = Parameter(query="session_id"),
    ) -> list[dict]:
        """Get chat history for a session."""
        db = SessionLocal()
        try:
            messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
            return [_message_to_dict(m) for m in messages]
        finally:
            db.close()

    @get("/chat/sessions")
    async def list_sessions(self) -> list[dict]:
        """List all chat sessions."""
        db = SessionLocal()
        try:
            from sqlalchemy import func, distinct
            sessions = (
                db.query(
                    ChatMessage.session_id,
                    func.min(ChatMessage.created_at).label("started_at"),
                    func.max(ChatMessage.created_at).label("last_message_at"),
                    func.count(ChatMessage.id).label("message_count"),
                )
                .group_by(ChatMessage.session_id)
                .order_by(func.max(ChatMessage.created_at).desc())
                .all()
            )
            return [
                {
                    "session_id": s.session_id,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
                    "message_count": s.message_count,
                }
                for s in sessions
            ]
        finally:
            db.close()

    @get("/analyses")
    async def list_analyses(self) -> list[dict]:
        """List past AI analyses."""
        db = SessionLocal()
        try:
            analyses = (
                db.query(AnalysisHistory)
                .order_by(AnalysisHistory.created_at.desc())
                .limit(50)
                .all()
            )
            return [_analysis_to_dict(a) for a in analyses]
        finally:
            db.close()

    @get("/status")
    async def ai_status(self) -> dict:
        """Check AI service connectivity."""
        connected = advisor.check_connection()
        models = advisor.list_models() if connected else []
        return {
            "connected": connected,
            "model": advisor.model,
            "available_models": models,
            "ollama_url": advisor.base_url,
        }
