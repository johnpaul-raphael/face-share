import secrets
import string
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import uuid4
from datetime import datetime, timezone

from app.api.deps import get_current_user
from app.core.dynamodb import dynamodb_service
from app.core.s3 import generate_presigned_download_url
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventDetailResponse,
    EventJoinRequest, EventJoinResponse, EventParticipantResponse,
    ParticipationStatus,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_JOIN_CODE_CHARS = string.ascii_uppercase + string.digits


def _generate_join_code(length: int = 6) -> str:
    return ''.join(secrets.choice(_JOIN_CODE_CHARS) for _ in range(length))


def _resolve_cover_url(raw: str | None) -> str | None:
    """If cover_image_url is an S3 key (not a URL), generate a fresh presigned URL."""
    if not raw or raw.startswith('http'):
        return raw
    return generate_presigned_download_url(raw)


def _event_item_to_response(event: dict, participant_count: int = 0) -> EventResponse:
    raw_cover = event.get('cover_image_url')
    return EventResponse(
        id=event['event_id'],
        name=event['name'],
        description=event.get('description'),
        owner_id=event['owner_id'],
        owner_name=event.get('owner_name', ''),
        cover_image_url=_resolve_cover_url(raw_cover),
        cover_photo_s3_key=raw_cover if raw_cover and not raw_cover.startswith('http') else None,
        join_code=event['join_code'],
        created_at=event.get('created_at', ''),
        updated_at=event.get('updated_at'),
        participant_count=participant_count,
    )


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    event_data: EventCreate,
    current_user=Depends(get_current_user),
):
    event_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Generate unique join code (retry up to 10 times)
    for _ in range(10):
        join_code = _generate_join_code()
        if not dynamodb_service.get_event_by_join_code(join_code):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique join code")

    success = dynamodb_service.create_event(
        event_id=event_id,
        owner_id=current_user.id,
        name=event_data.name,
        description=event_data.description,
        cover_image_url=event_data.cover_image_url,
        join_code=join_code,
        owner_name=current_user.name,
        created_at=now,
        updated_at=now,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create event")

    dynamodb_service.create_join_code_lookup(join_code, event_id)
    dynamodb_service.add_event_participant(
        event_id=event_id,
        user_id=current_user.id,
        status='approved',
        can_upload=True,
        user_name=current_user.name,
        user_email=current_user.email,
        joined_at=now,
    )

    event = dynamodb_service.get_event(event_id)
    return _event_item_to_response(event, participant_count=1)


@router.get("", response_model=list[EventResponse])
async def list_events(current_user=Depends(get_current_user)):
    owned = dynamodb_service.get_user_events(current_user.id)
    joined = dynamodb_service.get_events_user_joined(current_user.id)

    # Deduplicate (owner is also a participant record)
    seen = set()
    all_events = []
    for ev in owned + joined:
        eid = ev.get('event_id')
        if eid and eid not in seen:
            seen.add(eid)
            all_events.append(ev)

    result = []
    for ev in all_events:
        participants = dynamodb_service.get_event_participants(ev['event_id'])
        result.append(_event_item_to_response(ev, participant_count=len(participants)))
    return result


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event(event_id: str, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    participant = dynamodb_service.get_participant(event_id, current_user.id)
    if not participant and event.get('owner_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not a participant of this event")

    participants_raw = dynamodb_service.get_event_participants(event_id)
    participants = [
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

    base = _event_item_to_response(event, participant_count=len(participants))
    return EventDetailResponse(**base.model_dump(), participants=participants)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    event_update: EventUpdate,
    current_user=Depends(get_current_user),
):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can update this event")

    updates = event_update.model_dump(exclude_none=True)
    if updates:
        dynamodb_service.update_event(event_id, **updates)

    updated = dynamodb_service.get_event(event_id)
    participants = dynamodb_service.get_event_participants(event_id)
    return _event_item_to_response(updated, participant_count=len(participants))


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: str, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can delete this event")

    dynamodb_service.delete_join_code_lookup(event['join_code'])
    dynamodb_service.delete_event(event_id)


@router.post("/join", response_model=EventJoinResponse)
async def join_event(
    join_request: EventJoinRequest,
    current_user=Depends(get_current_user),
):
    event = dynamodb_service.get_event_by_join_code(join_request.join_code.upper().strip())
    if not event:
        raise HTTPException(status_code=404, detail="Invalid join code")

    event_id = event['event_id']
    existing = dynamodb_service.get_participant(event_id, current_user.id)
    if existing:
        raise HTTPException(status_code=400, detail="You are already a participant of this event")

    now = datetime.now(timezone.utc).isoformat()
    dynamodb_service.add_event_participant(
        event_id=event_id,
        user_id=current_user.id,
        status='approved',
        user_name=current_user.name,
        user_email=current_user.email,
        joined_at=now,
    )

    # Backfill face matches from already-processed photos using stored raw Rekognition results.
    # This means zero extra Rekognition API calls for late joiners.
    all_photos = dynamodb_service.get_event_photos(event_id)
    backfilled = 0
    for photo in all_photos:
        raw_matched = photo.get('raw_matched_user_ids', [])
        if current_user.id in raw_matched:
            photo_id = photo['photo_id']
            # Check we don't create a duplicate match
            existing_matches = dynamodb_service.get_photo_matches(photo_id)
            already_matched = any(m.get('user_id') == current_user.id for m in existing_matches)
            if not already_matched:
                match_id = str(uuid4())
                dynamodb_service.create_face_match(
                    match_id=match_id,
                    photo_id=photo_id,
                    user_id=current_user.id,
                    confidence=0.0,  # Original similarity not stored per-user; 0 signals backfill
                    created_at=now,
                )
                backfilled += 1

    if backfilled:
        logger.info("[join-event] Backfilled %d photo matches for late joiner %s", backfilled, current_user.id)

    participants = dynamodb_service.get_event_participants(event_id)
    event_response = _event_item_to_response(event, participant_count=len(participants))
    return EventJoinResponse(event=event_response, status=ParticipationStatus.APPROVED)
