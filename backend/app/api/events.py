import secrets
import string
import logging
import base64
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone

from app.api.deps import get_current_user
from app.core.dynamodb import dynamodb_service
from app.core.rekognition import rekognition_service
from app.core.config import settings
from app.core.s3 import generate_presigned_download_url, tag_s3_objects_for_deletion
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventDetailResponse,
    EventJoinRequest, EventJoinResponse, EventParticipantResponse,
    ParticipationStatus,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_JOIN_CODE_CHARS = string.ascii_uppercase + string.digits


async def _backfill_new_participant(event_id: str, user_id: str) -> None:
    """Re-scan all processed photos in an event for a newly joined user.

    Runs as a background task after join. Uses real Rekognition calls so we
    get accurate confidence scores (unlike the old raw_matched_user_ids path
    which stored 0.0).
    """
    photos = dynamodb_service.get_event_photos(event_id)
    processed = [p for p in photos if not p.get('is_processing', True) and p.get('s3_key')]
    if not processed:
        return

    now = datetime.now(timezone.utc).isoformat()
    matched = 0
    for photo in processed:
        photo_id = photo['photo_id']

        # Skip if we already have a match record for this user on this photo
        existing = dynamodb_service.get_photo_matches(photo_id)
        if any(m.get('user_id') == user_id for m in existing):
            continue

        try:
            matches = rekognition_service.search_faces_by_image(
                s3_bucket=settings.S3_BUCKET_NAME,
                s3_key=photo['s3_key'],
                threshold=settings.REKOGNITION_FACE_MATCH_THRESHOLD,
            )
        except Exception as e:
            logger.warning("[backfill] Rekognition search failed for photo %s: %s", photo_id, e)
            continue

        for m in matches:
            if m.get('external_image_id') == user_id:
                match_id = str(uuid4())
                dynamodb_service.create_face_match(
                    match_id=match_id,
                    photo_id=photo_id,
                    user_id=user_id,
                    confidence=m['similarity'],
                    created_at=now,
                )
                dynamodb_service.increment_photo_match_count(event_id, photo_id)
                matched += 1
                break

    logger.info("[backfill] Backfilled %d photo(s) for user %s in event %s", matched, user_id, event_id)


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


@router.get("")
async def list_events(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
):
    # Events are small lists per user — fetch all then paginate in memory
    owned = dynamodb_service.get_user_events(current_user.id)
    joined = dynamodb_service.get_events_user_joined(current_user.id)

    seen: set = set()
    all_events = []
    for ev in owned + joined:
        eid = ev.get('event_id')
        if eid and eid not in seen:
            seen.add(eid)
            all_events.append(ev)

    # Apply cursor (event_id offset) and limit
    start = 0
    if cursor:
        decoded = base64.b64decode(cursor.encode()).decode()
        ids = [ev.get('event_id') for ev in all_events]
        start = ids.index(decoded) + 1 if decoded in ids else 0

    page = all_events[start:start + limit]
    last = page[-1].get('event_id') if len(page) == limit and start + limit < len(all_events) else None
    next_cursor = base64.b64encode(last.encode()).decode() if last else None

    result = []
    for ev in page:
        participants = dynamodb_service.get_event_participants(ev['event_id'])
        result.append(_event_item_to_response(ev, participant_count=len(participants)))
    return {"items": result, "next_cursor": next_cursor}


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
async def delete_event(event_id: str, background_tasks: BackgroundTasks, current_user=Depends(get_current_user)):
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can delete this event")

    # Collect all S3 keys before deleting DB records
    photos = dynamodb_service.get_event_photos(event_id)
    s3_keys = [
        key
        for photo in photos
        for key in (photo.get('s3_key'), photo.get('thumbnail_s3_key'))
        if key
    ]

    # Hard delete: matches → photos → participants → join code → event
    for photo in photos:
        dynamodb_service.delete_all_photo_matches(photo.get('photo_id', ''))
    dynamodb_service.delete_all_event_photos(event_id)
    dynamodb_service.delete_all_event_participants(event_id)
    dynamodb_service.delete_join_code_lookup(event['join_code'])
    dynamodb_service.delete_event(event_id)

    # Tag S3 objects for deletion after 7 days (background — non-blocking)
    if s3_keys:
        background_tasks.add_task(tag_s3_objects_for_deletion, s3_keys)


@router.post("/join", response_model=EventJoinResponse)
async def join_event(
    join_request: EventJoinRequest,
    background_tasks: BackgroundTasks,
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

    # Re-scan existing processed photos in the background with real Rekognition calls.
    # This handles the case where photos were uploaded before this user joined.
    background_tasks.add_task(_backfill_new_participant, event_id, current_user.id)

    participants = dynamodb_service.get_event_participants(event_id)
    event_response = _event_item_to_response(event, participant_count=len(participants))
    return EventJoinResponse(event=event_response, status=ParticipationStatus.APPROVED)
