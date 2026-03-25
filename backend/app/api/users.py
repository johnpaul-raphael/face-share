from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.schemas.user import UserResponse, UserUpdate, FaceProfileResponse, FaceProfileImageResponse
from app.api.deps import get_current_user
from app.core.dynamodb import dynamodb_service
from app.core.s3 import delete_s3_object, generate_presigned_download_url
from app.core.rekognition import rekognition_service
from datetime import datetime, timezone

router = APIRouter()


def _user_to_response(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at or datetime.now(timezone.utc).isoformat(),
        updated_at=user.updated_at or datetime.now(timezone.utc).isoformat(),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return _user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(user_update: UserUpdate, current_user=Depends(get_current_user)):
    updates = user_update.model_dump(exclude_none=True)
    if 'email' in updates and updates['email'] != current_user.email:
        existing = dynamodb_service.get_user_by_email(updates['email'])
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
    if updates:
        dynamodb_service.update_user(current_user.id, **updates)
    updated_item = dynamodb_service.get_user_by_id(current_user.id)
    if not updated_item:
        raise HTTPException(status_code=404, detail="User not found")
    from app.services.dynamodb_auth_service import DynamoDBUser
    updated_user = DynamoDBUser(updated_item)
    return _user_to_response(updated_user)


@router.get("/me/face-profile", response_model=FaceProfileResponse)
async def get_face_profile(current_user=Depends(get_current_user)):
    face_profiles_raw = dynamodb_service.get_user_face_profiles(current_user.id)
    images = []
    for fp in face_profiles_raw:
        image_id = fp.get('image_id', '')
        s3_key = fp.get('s3_key', '')
        url = generate_presigned_download_url(s3_key) if s3_key else None
        images.append(FaceProfileImageResponse(
            id=image_id,
            s3_key=s3_key,
            url=url,
            description=fp.get('description'),
            created_at=fp.get('created_at', datetime.now(timezone.utc).isoformat()),
        ))
    return FaceProfileResponse(
        user_id=current_user.id,
        images=images,
        image_count=len(images),
        is_complete=3 <= len(images) <= 5,
    )


@router.delete("/me/face-profile/{image_id}", status_code=204)
async def delete_face_profile_image(image_id: str, current_user=Depends(get_current_user)):
    face_image = dynamodb_service.get_face_profile_image(current_user.id, image_id)
    if not face_image:
        raise HTTPException(status_code=404, detail="Face profile image not found")

    rekognition_face_id = face_image.get('rekognition_face_id')
    if rekognition_face_id:
        rekognition_service.delete_face(rekognition_face_id)

    s3_key = face_image.get('s3_key')
    if s3_key:
        delete_s3_object(s3_key)

    dynamodb_service.delete_face_profile(current_user.id, image_id)


@router.delete("/me", status_code=204)
async def delete_account(background_tasks: BackgroundTasks, current_user=Depends(get_current_user)):
    """Permanently delete the current user's account and all associated data (GDPR)."""
    user_id = current_user.id

    # 1. Delete face profiles — Rekognition, S3, DynamoDB
    face_profiles = dynamodb_service.get_user_face_profiles(user_id)
    for fp in face_profiles:
        rekognition_face_id = fp.get('rekognition_face_id')
        if rekognition_face_id:
            rekognition_service.delete_face(rekognition_face_id)
        s3_key = fp.get('s3_key')
        if s3_key:
            background_tasks.add_task(delete_s3_object, s3_key)
        dynamodb_service.delete_face_profile(user_id, fp['image_id'])

    # 2. Remove participations from all joined events
    joined_events = dynamodb_service.get_events_user_joined(user_id)
    for event in joined_events:
        dynamodb_service.delete_participant(event['event_id'], user_id)

    # 3. Delete user record
    dynamodb_service.delete_user(user_id)


@router.get("/me/photos")
async def get_my_photos(current_user=Depends(get_current_user)):
    """Return all photos where the current user appears, grouped by event."""
    match_records = dynamodb_service.get_user_photos_with_details(current_user.id)

    # Discard matches without event_id (legacy records before the fix)
    valid_matches = [m for m in match_records if m.get('photo_id') and m.get('event_id')]
    if not valid_matches:
        return []

    # Fetch unique events in one pass to avoid N+1
    unique_event_ids = {m['event_id'] for m in valid_matches}
    events_by_id = {}
    for eid in unique_event_ids:
        ev = dynamodb_service.get_event(eid)
        if ev:
            events_by_id[eid] = ev

    photos_by_event: dict = {}
    for match in valid_matches:
        photo_id = match['photo_id']
        event_id = match['event_id']

        if event_id not in events_by_id:
            continue  # event deleted

        photo = dynamodb_service.get_photo(event_id, photo_id)
        if not photo:
            continue

        s3_key = photo.get('s3_key', '')
        download_url = generate_presigned_download_url(s3_key) if s3_key else None

        photo_entry = {
            'photo_id': photo_id,
            'event_id': event_id,
            'url': download_url,
            's3_key': s3_key,
            'uploaded_at': photo.get('uploaded_at', ''),
            'is_processing': photo.get('is_processing', False),
            'confidence': float(match.get('confidence', 0)),
            'is_confirmed': match.get('is_confirmed', False),
            'match_id': match.get('match_id', ''),
        }

        if event_id not in photos_by_event:
            ev = events_by_id[event_id]
            photos_by_event[event_id] = {
                'event_id': event_id,
                'event_name': ev.get('name', ''),
                'photos': [],
            }
        photos_by_event[event_id]['photos'].append(photo_entry)

    return list(photos_by_event.values())
