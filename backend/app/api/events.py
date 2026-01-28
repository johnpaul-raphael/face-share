from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from typing import Union
import secrets
import string
from app.database.session import get_db
from app.database.models import User, Event, EventParticipant, ParticipationStatus
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventJoinRequest,
    EventJoinResponse,
)
from app.api.deps import get_current_user
from app.services.event_service import generate_unique_join_code

router = APIRouter()


def event_to_response(event: Event, include_participants: bool = False) -> Union[EventResponse, EventDetailResponse]:
    """Convert Event model to response schema."""
    confirmed_count = sum(1 for p in event.participants if p.status == ParticipationStatus.CONFIRMED)
    pending_count = sum(1 for p in event.participants if p.status == ParticipationStatus.PENDING)
    
    base_data = {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "owner_id": event.owner_id,
        "owner_name": event.owner.name,
        "cover_image_url": event.cover_image_url,
        "join_code": event.join_code,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "participant_count": len(event.participants),
        "confirmed_participant_count": confirmed_count,
        "pending_participant_count": pending_count,
    }
    
    if include_participants:
        from app.schemas.event import EventParticipantResponse
        participants = [
            EventParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                user_name=p.user.name,
                user_email=p.user.email,
                user_avatar_url=p.user.avatar_url,
                status=p.status,
                joined_at=p.joined_at
            )
            for p in event.participants
        ]
        return EventDetailResponse(**base_data, participants=participants)
    
    return EventResponse(**base_data)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new event."""
    # Generate unique join code
    join_code = generate_unique_join_code(db)
    
    new_event = Event(
        name=event_data.name,
        description=event_data.description,
        owner_id=current_user.id,
        cover_image_url=event_data.cover_image_url,
        join_code=join_code
    )
    
    db.add(new_event)
    
    # Add owner as confirmed participant
    owner_participation = EventParticipant(
        event_id=new_event.id,
        user_id=current_user.id,
        status=ParticipationStatus.CONFIRMED
    )
    db.add(owner_participation)
    
    db.commit()
    db.refresh(new_event)
    
    return event_to_response(new_event)


@router.get("", response_model=list[EventResponse])
async def list_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all events the user is part of."""
    events = db.query(Event).join(EventParticipant).filter(
        EventParticipant.user_id == current_user.id
    ).all()
    
    return [event_to_response(event) for event in events]


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get event details."""
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is a participant
    participation = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == current_user.id
    ).first()
    
    if not participation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant of this event"
        )
    
    return event_to_response(event, include_participants=True)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    event_update: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an event (owner only)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can update the event"
        )
    
    if event_update.name is not None:
        event.name = event_update.name
    if event_update.description is not None:
        event.description = event_update.description
    if event_update.cover_image_url is not None:
        event.cover_image_url = event_update.cover_image_url
    
    db.commit()
    db.refresh(event)
    
    return event_to_response(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an event (owner only)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can delete the event"
        )
    
    db.delete(event)
    db.commit()
    
    return None


@router.post("/join", response_model=EventJoinResponse)
async def join_event(
    join_request: EventJoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join an event using join code."""
    event = db.query(Event).filter(Event.join_code == join_request.join_code).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid join code"
        )
    
    # Check if already a participant
    existing_participation = db.query(EventParticipant).filter(
        EventParticipant.event_id == event.id,
        EventParticipant.user_id == current_user.id
    ).first()
    
    if existing_participation:
        return EventJoinResponse(
            event=event_to_response(event),
            status=existing_participation.status
        )
    
    # Create new participation
    new_participation = EventParticipant(
        event_id=event.id,
        user_id=current_user.id,
        status=ParticipationStatus.PENDING
    )
    
    db.add(new_participation)
    db.commit()
    
    return EventJoinResponse(
        event=event_to_response(event),
        status=ParticipationStatus.PENDING
    )
