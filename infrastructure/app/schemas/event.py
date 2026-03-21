from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ParticipationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"


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
    user_id: str
    user_name: str
    user_email: str
    user_avatar_url: Optional[str] = None
    status: ParticipationStatus
    joined_at: Optional[datetime] = None
    can_upload: bool = False


class EventResponse(EventBase):
    id: str
    owner_id: str
    owner_name: str
    cover_image_url: Optional[str] = None
    cover_photo_s3_key: Optional[str] = None
    join_code: str
    created_at: str
    updated_at: Optional[str] = None
    participant_count: int = 0


class EventDetailResponse(EventResponse):
    participants: List[EventParticipantResponse] = []


class EventJoinRequest(BaseModel):
    join_code: str


class EventJoinResponse(BaseModel):
    event: EventResponse
    status: ParticipationStatus
