from sqlalchemy.orm import Session
from uuid import UUID
from app.database.models import Photo, FaceMatch, Event, EventParticipant, ParticipationStatus
from typing import List, Optional


def get_photos_with_low_confidence_matches(
    db: Session,
    event_id: UUID,
    confidence_threshold: float = 0.8
) -> List[Photo]:
    """Get all photos in an event that have low-confidence face matches."""
    photos = db.query(Photo).filter(
        Photo.event_id == event_id,
        Photo.is_processing == False
    ).all()
    
    low_confidence_photos = []
    for photo in photos:
        low_confidence_matches = [
            m for m in photo.face_matches
            if m.confidence < confidence_threshold or not m.is_confirmed
        ]
        if low_confidence_matches:
            low_confidence_photos.append(photo)
    
    return low_confidence_photos


def get_unconfirmed_matches_for_photo(
    db: Session,
    photo_id: UUID
) -> List[FaceMatch]:
    """Get all unconfirmed face matches for a photo."""
    return db.query(FaceMatch).filter(
        FaceMatch.photo_id == photo_id,
        FaceMatch.is_confirmed == False
    ).all()


def confirm_face_match(
    db: Session,
    match_id: UUID,
    user_id: Optional[UUID] = None
) -> FaceMatch:
    """Confirm a face match, optionally assigning it to a user."""
    match = db.query(FaceMatch).filter(FaceMatch.id == match_id).first()
    if not match:
        raise ValueError("Face match not found")
    
    match.is_confirmed = True
    if user_id is not None:
        match.user_id = user_id
    
    db.commit()
    db.refresh(match)
    return match


def remove_face_match(
    db: Session,
    match_id: UUID
) -> None:
    """Remove a face match."""
    match = db.query(FaceMatch).filter(FaceMatch.id == match_id).first()
    if not match:
        raise ValueError("Face match not found")
    
    db.delete(match)
    db.commit()


def get_user_photos(
    db: Session,
    user_id: UUID,
    event_id: Optional[UUID] = None
) -> List[Photo]:
    """Get all photos where a user appears (confirmed matches only)."""
    query = db.query(Photo).join(FaceMatch).filter(
        FaceMatch.user_id == user_id,
        FaceMatch.is_confirmed == True
    )
    
    if event_id:
        query = query.filter(Photo.event_id == event_id)
    
    return query.distinct().all()
