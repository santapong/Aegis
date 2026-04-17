from datetime import datetime
from pydantic import BaseModel

from ..models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    message: str
    link: str | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    type: NotificationType = NotificationType.info
    title: str
    message: str
    link: str | None = None
    dedupe_key: str


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
