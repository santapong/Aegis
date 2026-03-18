"""AI resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import (
    AIStatus,
    AnalysisResult,
    ChatMessage,
    ChatResponse,
    ChatSession,
)


class AIResource:
    """Provides access to AI endpoints (``/api/ai``)."""

    _path = "/api/ai"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- Analysis -----------------------------------------------------------

    def analyze(self, *, custom_prompt: str | None = None) -> AnalysisResult:
        """Run an AI analysis of financial data.

        Args:
            custom_prompt: Optional custom prompt to guide the analysis.
        """
        body: dict[str, Any] = {}
        if custom_prompt is not None:
            body["custom_prompt"] = custom_prompt
        resp = self._client.post(f"{self._path}/analyze", json=body)
        resp.raise_for_status()
        return AnalysisResult.model_validate(resp.json())

    def list_analyses(self) -> list[AnalysisResult]:
        """List all previous AI analyses."""
        resp = self._client.get(f"{self._path}/analyses")
        resp.raise_for_status()
        return [AnalysisResult.model_validate(item) for item in resp.json()]

    # -- Chat ---------------------------------------------------------------

    def chat(
        self, message: str, *, session_id: str | None = None
    ) -> ChatResponse:
        """Send a chat message to the AI assistant.

        Args:
            message: The user message.
            session_id: Optional session ID to continue a conversation.
        """
        body: dict[str, Any] = {"message": message}
        if session_id is not None:
            body["session_id"] = session_id
        resp = self._client.post(f"{self._path}/chat", json=body)
        resp.raise_for_status()
        return ChatResponse.model_validate(resp.json())

    def chat_history(self, session_id: str) -> list[ChatMessage]:
        """Retrieve chat history for a session.

        Args:
            session_id: The session ID to retrieve history for.
        """
        resp = self._client.get(
            f"{self._path}/chat/history", params={"session_id": session_id}
        )
        resp.raise_for_status()
        return [ChatMessage.model_validate(item) for item in resp.json()]

    def chat_sessions(self) -> list[ChatSession]:
        """List all chat sessions."""
        resp = self._client.get(f"{self._path}/chat/sessions")
        resp.raise_for_status()
        return [ChatSession.model_validate(item) for item in resp.json()]

    # -- Status -------------------------------------------------------------

    def status(self) -> AIStatus:
        """Check AI service availability and configuration."""
        resp = self._client.get(f"{self._path}/status")
        resp.raise_for_status()
        return AIStatus.model_validate(resp.json())
