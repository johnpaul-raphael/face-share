from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.core.dynamodb import dynamodb_service
from app.schemas.event import EventParticipantResponse, ParticipationStatus

router = APIRouter()


@router.get("/events/{event_id}/participants", response_model=list[EventParticipantResponse])
async def list_participants(event_id: str, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    participant = dynamodb_service.get_participant(event_id, current_user.id)
    if not participant and event.get('owner_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not a participant of this event")

    participants_raw = dynamodb_service.get_event_participants(event_id)
    return [
        EventParticipantResponse(
            user_id=p['user_id'],
            user_name=p.get('user_name', ''),
            user_email=p.get('user_email', ''),
            user_avatar_url=p.get('user_avatar_url'),
            status=ParticipationStatus(p.get('status', 'approved')),
            joined_at=p.get('joined_at'),
            can_upload=p.get('can_upload', False),
        )
        for p in participants_raw
    ]


@router.patch("/events/{event_id}/participants/{user_id}/approve", response_model=EventParticipantResponse)
async def approve_participant(event_id: str, user_id: str, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can approve participants")

    participant = dynamodb_service.get_participant(event_id, user_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    dynamodb_service.update_participant_status(event_id, user_id, 'approved')
    updated = dynamodb_service.get_participant(event_id, user_id)
    return EventParticipantResponse(
        user_id=updated['user_id'],
        user_name=updated.get('user_name', ''),
        user_email=updated.get('user_email', ''),
        user_avatar_url=updated.get('user_avatar_url'),
        status=ParticipationStatus(updated.get('status', 'approved')),
        joined_at=updated.get('joined_at'),
        can_upload=updated.get('can_upload', False),
    )


@router.patch("/events/{event_id}/participants/{user_id}/upload-permission", response_model=EventParticipantResponse)
async def set_upload_permission(
    event_id: str,
    user_id: str,
    grant: bool,
    current_user=Depends(get_current_user),
):
    """Grant or revoke upload permission for a participant (owner only)."""
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can manage upload permissions")

    participant = dynamodb_service.get_participant(event_id, user_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    dynamodb_service.update_participant(event_id, user_id, can_upload=grant)
    updated = dynamodb_service.get_participant(event_id, user_id)
    return EventParticipantResponse(
        user_id=updated['user_id'],
        user_name=updated.get('user_name', ''),
        user_email=updated.get('user_email', ''),
        user_avatar_url=updated.get('user_avatar_url'),
        status=ParticipationStatus(updated.get('status', 'approved')),
        joined_at=updated.get('joined_at'),
        can_upload=updated.get('can_upload', False),
    )


@router.delete("/events/{event_id}/participants/{user_id}", status_code=204)
async def remove_participant(event_id: str, user_id: str, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_owner = event['owner_id'] == current_user.id
    is_self = current_user.id == user_id
    if not is_owner and not is_self:
        raise HTTPException(status_code=403, detail="You do not have permission to remove this participant")

    participant = dynamodb_service.get_participant(event_id, user_id)
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    dynamodb_service.delete_participant(event_id, user_id)
