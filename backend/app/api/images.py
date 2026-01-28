from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID, uuid4
from app.database.session import get_db
from app.database.models import User, Event, FaceProfileImage
from app.schemas.image import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    PresignedDownloadRequest,
    PresignedDownloadResponse,
)
from app.api.deps import get_current_user
from app.core.s3 import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    get_s3_key_for_photo,
    get_s3_key_for_face_profile,
)
from app.core.config import settings

router = APIRouter()


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    request: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a presigned URL for uploading an image."""
    s3_key = None
    
    if request.event_id:
        # Event photo upload
        # Verify user is a participant
        from app.database.models import EventParticipant
        participation = db.query(EventParticipant).filter(
            EventParticipant.event_id == request.event_id,
            EventParticipant.user_id == current_user.id
        ).first()
        
        if not participation:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant of this event"
            )
        
        photo_id = uuid4()
        s3_key = get_s3_key_for_photo(str(request.event_id), str(photo_id), request.filename)
    
    elif request.user_id and request.face_image_id:
        # Face profile image upload
        if request.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only upload face profile images for yourself"
            )
        
        s3_key = get_s3_key_for_face_profile(
            str(request.user_id),
            str(request.face_image_id),
            request.filename
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either event_id or (user_id and face_image_id) must be provided"
        )
    
    upload_url = generate_presigned_upload_url(
        key=s3_key,
        content_type=request.content_type
    )
    
    if not upload_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate presigned URL"
        )
    
    return PresignedUploadResponse(
        upload_url=upload_url,
        s3_key=s3_key,
        expires_in=settings.S3_PRESIGNED_URL_EXPIRATION
    )


@router.post("/presigned-download", response_model=PresignedDownloadResponse)
async def get_presigned_download_url(
    request: PresignedDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a presigned URL for downloading an image."""
    download_url = generate_presigned_download_url(key=request.s3_key)
    
    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate presigned URL"
        )
    
    return PresignedDownloadResponse(
        download_url=download_url,
        expires_in=settings.S3_PRESIGNED_URL_EXPIRATION
    )


@router.post("/face-profile/confirm-upload")
async def confirm_face_profile_upload(
    face_image_id: UUID,
    s3_key: str,
    description: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm that a face profile image has been uploaded to S3."""
    # Verify the s3_key belongs to this user
    expected_prefix = f"users/{current_user.id}/face-profile/{face_image_id}/"
    if not s3_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid S3 key for face profile image"
        )
    
    # Check if image already exists
    existing = db.query(FaceProfileImage).filter(
        FaceProfileImage.id == face_image_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face profile image already exists"
        )
    
    # Check image count limit (3-5 images)
    image_count = db.query(FaceProfileImage).filter(
        FaceProfileImage.user_id == current_user.id
    ).count()
    
    if image_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 5 face profile images allowed"
        )
    
    # Create face profile image record
    new_image = FaceProfileImage(
        id=face_image_id,
        user_id=current_user.id,
        s3_key=s3_key,
        description=description
    )
    
    db.add(new_image)
    db.commit()
    db.refresh(new_image)
    
    return {"id": new_image.id, "s3_key": new_image.s3_key}
