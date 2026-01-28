from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.database.models import ParticipationStatus


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None


class EventCreate(EventBase):
    cover_image_url: Optional[str] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class EventParticipantResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    user_avatar_url: Optional[str]
    status: ParticipationStatus
    joined_at: datetime

    class Config:
        from_attributes = True


class EventResponse(EventBase):
    id: UUID
    owner_id: UUID
    owner_name: str
    cover_image_url: Optional[str] = None
    join_code: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    participant_count: int = 0
    confirmed_participant_count: int = 0
    pending_participant_count: int = 0

    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    participants: List[EventParticipantResponse] = []


class EventJoinRequest(BaseModel):
    join_code: str


class EventJoinResponse(BaseModel):
    event: EventResponse
    status: ParticipationStatus
