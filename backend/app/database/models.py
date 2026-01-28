from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database.base import Base


class ParticipationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owned_events = relationship("Event", back_populates="owner", foreign_keys="Event.owner_id")
    face_profile_images = relationship("FaceProfileImage", back_populates="user", cascade="all, delete-orphan")
    uploaded_photos = relationship("Photo", back_populates="uploader", foreign_keys="Photo.uploader_id")
    event_participations = relationship("EventParticipant", back_populates="user")
    face_matches = relationship("FaceMatch", back_populates="matched_user")


class FaceProfileImage(Base):
    __tablename__ = "face_profile_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    s3_key = Column(String(512), nullable=False)
    description = Column(String(255), nullable=True)
    rekognition_face_id = Column(String(255), nullable=True)  # AWS Rekognition face ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="face_profile_images")


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cover_image_url = Column(String(512), nullable=True)
    join_code = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="owned_events", foreign_keys=[owner_id])
    participants = relationship("EventParticipant", back_populates="event", cascade="all, delete-orphan")
    photos = relationship("Photo", back_populates="event", cascade="all, delete-orphan")


class EventParticipant(Base):
    __tablename__ = "event_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(ParticipationStatus), default=ParticipationStatus.PENDING, nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="participants")
    user = relationship("User", back_populates="event_participations")

    # Unique constraint: user can only participate once per event
    __table_args__ = (
        UniqueConstraint('event_id', 'user_id', name='unique_event_user'),
    )


class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    uploader_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    s3_key = Column(String(512), nullable=False)
    is_processing = Column(Boolean, default=True, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="photos")
    uploader = relationship("User", back_populates="uploaded_photos", foreign_keys=[uploader_id])
    face_matches = relationship("FaceMatch", back_populates="photo", cascade="all, delete-orphan")


class FaceMatch(Base):
    __tablename__ = "face_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    is_confirmed = Column(Boolean, default=False, nullable=False)
    face_image_s3_key = Column(String(512), nullable=True)  # Cropped face image
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    photo = relationship("Photo", back_populates="face_matches")
    matched_user = relationship("User", back_populates="face_matches", foreign_keys=[user_id])
