from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from app.database.session import get_db
from app.database.models import User, FaceProfileImage
from app.schemas.user import UserResponse, UserUpdate, FaceProfileImageResponse, FaceProfileResponse
from app.api.deps import get_current_user
from app.core.s3 import (
    generate_presigned_download_url,
    get_s3_key_for_face_profile,
    delete_s3_object,
)
from app.core.config import settings

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.email is not None:
        # Check if email is already taken
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        current_user.email = user_update.email
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/face-profile", response_model=FaceProfileResponse)
async def get_face_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's face profile images."""
    images = db.query(FaceProfileImage).filter(
        FaceProfileImage.user_id == current_user.id
    ).all()
    
    # Generate presigned URLs
    image_responses = []
    for img in images:
        url = generate_presigned_download_url(img.s3_key)
        image_responses.append(FaceProfileImageResponse(
            id=img.id,
            s3_key=img.s3_key,
            url=url,
            description=img.description,
            created_at=img.created_at
        ))
    
    return FaceProfileResponse(
        user_id=current_user.id,
        images=image_responses,
        image_count=len(images),
        is_complete=3 <= len(images) <= 5
    )


@router.delete("/me/face-profile/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_face_profile_image(
    image_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a face profile image."""
    image = db.query(FaceProfileImage).filter(
        FaceProfileImage.id == image_id,
        FaceProfileImage.user_id == current_user.id
    ).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Face profile image not found"
        )
    
    # Delete from S3
    delete_s3_object(image.s3_key)
    
    # Delete from database
    db.delete(image)
    db.commit()
    
    return None
