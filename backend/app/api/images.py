import logging
from botocore.exceptions import ClientError
import base64
import json
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from typing import Optional
from app.schemas.image import (
    PresignedUploadRequest, PresignedUploadResponse,
    PresignedDownloadRequest, PresignedDownloadResponse,
    PhotoResponse, FaceMatchResponse,
    MAX_EVENT_PHOTO_BYTES, MAX_FACE_PROFILE_BYTES,
)
from app.api.deps import get_current_user
from app.core.s3 import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    get_s3_key_for_photo,
    get_s3_key_for_face_profile,
    check_s3_object_exists,
    delete_s3_object,
)
from app.core.dynamodb import dynamodb_service
from app.core.rekognition import rekognition_service
from app.core.config import settings
from app.schemas.user import FaceProfileImageResponse
from uuid import uuid4
from datetime import datetime, timezone
from decimal import Decimal

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    request: PresignedUploadRequest,
    current_user=Depends(get_current_user),
):
    # ── File size guard (client-reported; enforced before any DB/S3 work) ──────
    if request.file_size is not None:
        limit = MAX_EVENT_PHOTO_BYTES if request.event_id else MAX_FACE_PROFILE_BYTES
        if request.file_size > limit:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {limit // (1024 * 1024)} MB.",
            )

    if request.event_id:
        # Event photo upload - check permission
        event = dynamodb_service.get_event(request.event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        is_owner = event['owner_id'] == current_user.id
        if not is_owner:
            participant = dynamodb_service.get_participant(request.event_id, current_user.id)
            if not participant:
                raise HTTPException(status_code=403, detail="You are not a participant of this event")
            if not participant.get('can_upload', False):
                raise HTTPException(
                    status_code=403,
                    detail="You do not have upload permission for this event. Ask the organizer to grant it."
                )

        # Create DynamoDB record immediately so Lambda (or process endpoint) can update it
        photo_id = str(uuid4())
        s3_key = get_s3_key_for_photo(request.event_id, photo_id, request.filename)
        now = datetime.now(timezone.utc).isoformat()
        dynamodb_service.create_photo(
            photo_id=photo_id,
            event_id=request.event_id,
            uploader_id=current_user.id,
            s3_key=s3_key,
            is_processing=True,
            uploaded_at=now,
        )
        upload_url = generate_presigned_upload_url(key=s3_key, content_type=request.content_type)
        if not upload_url:
            raise HTTPException(status_code=500, detail="Failed to generate presigned URL")
        return PresignedUploadResponse(
            upload_url=upload_url,
            s3_key=s3_key,
            expires_in=settings.S3_PRESIGNED_URL_EXPIRATION,
            photo_id=photo_id,
        )

    else:
        # Face profile image upload
        user_id = request.user_id or current_user.id
        face_image_id = request.face_image_id or str(uuid4())
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only upload face profile images for yourself")
        s3_key = get_s3_key_for_face_profile(user_id, face_image_id, request.filename)
        upload_url = generate_presigned_upload_url(key=s3_key, content_type=request.content_type)
        if not upload_url:
            raise HTTPException(status_code=500, detail="Failed to generate presigned URL")
        return PresignedUploadResponse(
            upload_url=upload_url,
            s3_key=s3_key,
            expires_in=settings.S3_PRESIGNED_URL_EXPIRATION,
            face_image_id=face_image_id,
        )


@router.post("/presigned-download", response_model=PresignedDownloadResponse)
async def get_presigned_download_url_endpoint(
    request: PresignedDownloadRequest,
    _current_user=Depends(get_current_user),
):
    download_url = generate_presigned_download_url(key=request.s3_key)
    if not download_url:
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL")
    return PresignedDownloadResponse(
        download_url=download_url,
        expires_in=settings.S3_PRESIGNED_URL_EXPIRATION,
    )


async def _backfill_face_profile_for_events(user_id: str) -> None:
    """After a user indexes their face, re-scan photos in all events they've joined.

    Runs as a background task. Complements _backfill_new_participant in events.py:
    that covers joining after photos exist; this covers setting up face profile
    after already being a participant.
    """
    events = dynamodb_service.get_events_user_joined(user_id)
    if not events:
        return

    now = datetime.now(timezone.utc).isoformat()
    for event in events:
        event_id = event['event_id']
        photos = dynamodb_service.get_event_photos(event_id)
        processed = [p for p in photos if not p.get('is_processing', True) and p.get('s3_key')]

        matched = 0
        for photo in processed:
            photo_id = photo['photo_id']

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
                logger.warning("[backfill-face] Rekognition failed for photo %s: %s", photo_id, e)
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

        if matched:
            logger.info("[backfill-face] Matched %d photo(s) for user %s in event %s", matched, user_id, event_id)


@router.post("/face-profile/confirm-upload", response_model=FaceProfileImageResponse)
async def confirm_face_profile_upload(
    face_image_id: str,
    s3_key: str,
    background_tasks: BackgroundTasks,
    description: str = None,
    current_user=Depends(get_current_user),
):
    """Index the uploaded face image with Rekognition and save to DynamoDB."""

    # -- Step 1: enforce image limit
    try:
        existing = dynamodb_service.get_user_face_profiles(current_user.id)
        if len(existing) >= 3:
            raise HTTPException(status_code=400, detail="You can have at most 3 face profile images.")
    except HTTPException:
        raise
    except ClientError as e:
        logger.error("[confirm-upload] DynamoDB get_user_face_profiles failed: %s", e)
        raise HTTPException(status_code=500, detail="Database error")

    # -- Step 2: verify file in S3
    logger.debug("[confirm-upload] Checking S3 bucket=%s key=%s", settings.S3_BUCKET_NAME, s3_key)
    try:
        exists = check_s3_object_exists(s3_key)
    except ClientError as e:
        logger.error("[confirm-upload] S3 check failed: %s", e)
        raise HTTPException(status_code=500, detail="S3 check error")

    if not exists:
        logger.warning("[confirm-upload] S3 object not found: %s", s3_key)
        raise HTTPException(status_code=400, detail="Image upload to S3 did not complete. Please try again.")
    logger.debug("[confirm-upload] S3 object found")

    # -- Step 3: Rekognition index_faces
    logger.debug("[confirm-upload] Calling Rekognition index_face...")
    try:
        result = rekognition_service.index_face(
            s3_bucket=settings.S3_BUCKET_NAME,
            s3_key=s3_key,
            external_image_id=current_user.id,
        )
    except RuntimeError as e:
        logger.error("[confirm-upload] Rekognition RuntimeError: %s", e)
        if "invalid_image_format" in str(e):
            raise HTTPException(status_code=400, detail="Invalid image format. Please upload a JPEG or PNG file.")
        raise HTTPException(status_code=502, detail="Face recognition service error")
    except Exception as e:
        logger.error("[confirm-upload] Unexpected Rekognition error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Rekognition error")

    if result is None:
        raise HTTPException(
            status_code=400,
            detail="No face detected. Please upload a clear, well-lit photo where your face is the main subject.",
        )
    logger.info("[confirm-upload] Face indexed: %s confidence=%.1f%%", result['face_id'], result['confidence'])

    # -- Step 4: save to DynamoDB
    now = datetime.now(timezone.utc).isoformat()
    try:
        dynamodb_service.create_face_profile(
            user_id=current_user.id,
            image_id=face_image_id,
            s3_key=s3_key,
            embedding=[],
            rekognition_face_id=result['face_id'],
            confidence=Decimal(str(result['confidence'])),
            description=description,
            created_at=now,
        )
    except Exception as e:
        logger.error("[confirm-upload] DynamoDB create_face_profile failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save face profile")

    url = generate_presigned_download_url(s3_key)
    logger.info("[confirm-upload] Done - face profile saved for user %s", current_user.id)

    # Re-scan existing event photos for this user now that their face is indexed.
    background_tasks.add_task(_backfill_face_profile_for_events, current_user.id)

    return FaceProfileImageResponse(
        id=face_image_id,
        s3_key=s3_key,
        url=url,
        description=description,
        created_at=now,
    )


@router.get("/events/{event_id}/photos")
async def get_event_photos(
    event_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    cursor: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
):
    """
    List photos for an event.
    - Owner: sees ALL photos (including processing and unmatched)
    - Participant: sees only photos where their face was matched
    """
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    is_owner = event.get('owner_id') == current_user.id
    participant = dynamodb_service.get_participant(event_id, current_user.id)

    if not participant and not is_owner:
        raise HTTPException(status_code=403, detail="Not a participant of this event")

    last_key = json.loads(base64.b64decode(cursor).decode()) if cursor else None
    photos_raw, next_key = dynamodb_service.get_event_photos_page(event_id, limit, last_key)
    next_cursor = base64.b64encode(json.dumps(next_key).encode()).decode() if next_key else None

    result = []
    for photo in photos_raw:
        photo_id = photo.get('photo_id', '')
        s3_key = photo.get('s3_key', '')

        if not is_owner:
            # Participants only see photos where their face was matched
            matches = dynamodb_service.get_photo_matches(photo_id)
            user_matched = any(m.get('user_id') == current_user.id for m in matches)
            if not user_matched:
                continue

        url = generate_presigned_download_url(s3_key) if s3_key else None
        # Only generate thumbnail URL once the Lambda has confirmed the thumbnail
        # exists by writing thumbnail_s3_key to DynamoDB. Never guess the key.
        thumbnail_s3_key = photo.get('thumbnail_s3_key')
        thumbnail_url = generate_presigned_download_url(thumbnail_s3_key) if thumbnail_s3_key else None
        match_count = int(photo.get('match_count', 0))
        result.append(PhotoResponse(
            photo_id=photo_id,
            event_id=event_id,
            uploader_id=photo.get('uploader_id', ''),
            s3_key=s3_key,
            url=url,
            thumbnail_url=thumbnail_url,
            is_processing=photo.get('is_processing', False),
            uploaded_at=photo.get('uploaded_at'),
            match_count=match_count,
        ))
    return {"items": result, "next_cursor": next_cursor}


@router.get("/events/{event_id}/photos/{photo_id}/matches", response_model=list[FaceMatchResponse])
async def get_photo_matches(
    event_id: str,
    photo_id: str,
    current_user=Depends(get_current_user),
):
    """List all face matches for a photo. Owner only."""
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can view match details")

    photo = dynamodb_service.get_photo(event_id, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    matches_raw = dynamodb_service.get_photo_matches(photo_id)
    result = []
    for m in matches_raw:
        user_id = m.get('user_id', '')
        user = dynamodb_service.get_user_by_id(user_id) if user_id else None
        result.append(FaceMatchResponse(
            match_id=m.get('match_id', ''),
            photo_id=photo_id,
            user_id=user_id,
            user_name=user.get('name') if user else None,
            user_email=user.get('email') if user else None,
            confidence=float(m.get('confidence', 0)),
            is_confirmed=m.get('is_confirmed', False),
            created_at=m.get('created_at'),
        ))
    return result


@router.post("/events/{event_id}/photos/{photo_id}/process")
async def process_event_photo(
    event_id: str,
    photo_id: str,
    current_user=Depends(get_current_user),
):
    """
    Run Rekognition face matching on an uploaded event photo.
    Creates face match records for participants whose faces are found.
    Sets is_processing=False when done.
    Called by the frontend after S3 upload completes.
    """
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can process photos")

    photo = dynamodb_service.get_photo(event_id, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    s3_key = photo['s3_key']
    logger.info("[process-photo] Starting Rekognition search for photo %s", photo_id)

    # Get all participant user IDs so we only create matches for event members
    participants_raw = dynamodb_service.get_event_participants(event_id)
    participant_ids = {p['user_id'] for p in participants_raw}

    # Run face search against the Rekognition collection
    try:
        matches = rekognition_service.search_faces_by_image(
            s3_bucket=settings.S3_BUCKET_NAME,
            s3_key=s3_key,
            threshold=settings.REKOGNITION_FACE_MATCH_THRESHOLD,
        )
    except Exception as e:
        logger.warning("[process-photo] Rekognition search failed: %s -- marking as processed with 0 matches", e)
        matches = []

    # Collect ALL matched user_ids from Rekognition (deduped by user_id, best similarity wins)
    now = datetime.now(timezone.utc).isoformat()
    all_raw_matches: dict[str, float] = {}  # user_id -> similarity
    for match in matches:
        user_id = match.get('external_image_id', '')
        similarity = float(match.get('similarity', 0))
        if user_id and (user_id not in all_raw_matches or similarity > all_raw_matches[user_id]):
            all_raw_matches[user_id] = similarity

    # Store raw matched user_ids on the photo for late-joiner backfill (zero future Rekognition calls)
    raw_matched_user_ids = list(all_raw_matches.keys())

    # Create match records only for users who are current participants
    matched_users: set = set()
    for user_id, similarity in all_raw_matches.items():
        if user_id in participant_ids:
            matched_users.add(user_id)
            match_id = str(uuid4())
            dynamodb_service.create_face_match(
                match_id=match_id,
                photo_id=photo_id,
                user_id=user_id,
                confidence=similarity,
                created_at=now,
            )
            dynamodb_service.increment_photo_match_count(event_id, photo_id)
            logger.info("[process-photo] Matched participant %s (similarity=%.1f%%)", user_id, similarity)

    unmatched_in_collection = [uid for uid in raw_matched_user_ids if uid not in participant_ids]
    if unmatched_in_collection:
        logger.info("[process-photo] Stored %d non-participant raw matches for future backfill", len(unmatched_in_collection))

    if not matched_users:
        logger.info("[process-photo] No participant matches found -- photo goes to review")

    # Mark photo as processed and persist raw matches for late-joiner support
    dynamodb_service.update_photo(
        event_id, photo_id,
        is_processing=False,
        raw_matched_user_ids=raw_matched_user_ids,
    )
    logger.info(
        "[process-photo] Done. matched_participants=%d, raw_matches=%d",
        len(matched_users), len(raw_matched_user_ids),
    )

    return {"processed": True, "matches_found": len(matched_users)}


@router.patch("/events/{event_id}/photos/{photo_id}/matches/{match_id}/confirm")
async def confirm_match(
    event_id: str, photo_id: str, match_id: str,
    current_user=Depends(get_current_user),
):
    """Confirm a face match (event owner only)."""
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can confirm matches")

    match = dynamodb_service.get_match(photo_id, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    dynamodb_service.update_match(photo_id, match_id, is_confirmed=True)
    return {"status": "confirmed", "match_id": match_id}


@router.delete("/events/{event_id}/photos/{photo_id}/matches/{match_id}", status_code=204)
async def delete_match(
    event_id: str, photo_id: str, match_id: str,
    current_user=Depends(get_current_user),
):
    """Remove a face match (event owner only)."""
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can remove matches")

    match = dynamodb_service.get_match(photo_id, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    dynamodb_service.delete_match(photo_id, match_id)
    dynamodb_service.increment_photo_match_count(event_id, photo_id, delta=-1)


@router.delete("/events/{event_id}/photos/{photo_id}", status_code=204)
async def delete_event_photo(
    event_id: str,
    photo_id: str,
    current_user=Depends(get_current_user),
):
    """
    Delete an event photo (event owner only).
    Cascades: removes all face match records, the DynamoDB photo record, and the S3 object.
    """
    event = dynamodb_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event['owner_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event owner can delete photos")

    photo = dynamodb_service.get_photo(event_id, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # 1. Delete all face match records for this photo
    matches = dynamodb_service.get_photo_matches(photo_id)
    for match in matches:
        dynamodb_service.delete_match(photo_id, match['match_id'])
    logger.info("[delete-photo] Deleted %d match records for photo %s", len(matches), photo_id)

    # 2. Delete the photo record from DynamoDB
    dynamodb_service.delete_photo(event_id, photo_id)

    # 3. Delete the file from S3
    s3_key = photo.get('s3_key', '')
    if s3_key:
        delete_s3_object(s3_key)

    logger.info("[delete-photo] Photo %s fully deleted", photo_id)
