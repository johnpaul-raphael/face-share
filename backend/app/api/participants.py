from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database.session import get_db
from app.database.models import User, Event, EventParticipant, ParticipationStatus
from app.schemas.event import EventParticipantResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/events/{event_id}/participants", response_model=list[EventParticipantResponse])
async def list_participants(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all participants of an event."""
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
    
    participants = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id
    ).all()
    
    return [
        EventParticipantResponse(
            id=p.id,
            user_id=p.user_id,
            user_name=p.user.name,
            user_email=p.user.email,
            user_avatar_url=p.user.avatar_url,
            status=p.status,
            joined_at=p.joined_at
        )
        for p in participants
    ]


@router.patch("/events/{event_id}/participants/{user_id}/approve", response_model=EventParticipantResponse)
async def approve_participant(
    event_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a pending participant (owner only)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event owner can approve participants"
        )
    
    participation = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == user_id
    ).first()
    
    if not participation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participation not found"
        )
    
    participation.status = ParticipationStatus.CONFIRMED
    db.commit()
    db.refresh(participation)
    
    return EventParticipantResponse(
        id=participation.id,
        user_id=participation.user_id,
        user_name=participation.user.name,
        user_email=participation.user.email,
        user_avatar_url=participation.user.avatar_url,
        status=participation.status,
        joined_at=participation.joined_at
    )


@router.delete("/events/{event_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    event_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a participant (owner only, or self-removal)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    participation = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == user_id
    ).first()
    
    if not participation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participation not found"
        )
    
    # Allow removal if owner or self
    if event.owner_id != current_user.id and user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove yourself or be removed by the event owner"
        )
    
    # Don't allow owner to remove themselves
    if event.owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event owner cannot be removed"
        )
    
    db.delete(participation)
    db.commit()
    
    return None
