import logging
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.image import (
    PresignedUploadRequest, PresignedUploadResponse,
    PresignedDownloadRequest, PresignedDownloadResponse,
    PhotoResponse,
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


@router.post("/face-profile/confirm-upload", response_model=FaceProfileImageResponse)
async def confirm_face_profile_upload(
    face_image_id: str,
    s3_key: str,
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
    return FaceProfileImageResponse(
        id=face_image_id,
        s3_key=s3_key,
        url=url,
        description=description,
        created_at=now,
    )


@router.get("/events/{event_id}/photos", response_model=list[PhotoResponse])
async def get_event_photos(event_id: str, current_user=Depends(get_current_user)):
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

    photos_raw = dynamodb_service.get_event_photos(event_id)
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
        match_count = dynamodb_service.get_photo_match_count(photo_id)
        result.append(PhotoResponse(
            photo_id=photo_id,
            event_id=event_id,
            uploader_id=photo.get('uploader_id', ''),
            s3_key=s3_key,
            url=url,
            is_processing=photo.get('is_processing', False),
            uploaded_at=photo.get('uploaded_at'),
            match_count=match_count,
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
            threshold=80.0,
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
