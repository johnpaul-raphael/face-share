from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FaceProfileImageBase(BaseModel):
    description: Optional[str] = None


class FaceProfileImageCreate(FaceProfileImageBase):
    pass


class FaceProfileImageResponse(FaceProfileImageBase):
    id: UUID
    s3_key: str
    url: Optional[str] = None  # Presigned URL
    created_at: datetime

    class Config:
        from_attributes = True


class FaceProfileResponse(BaseModel):
    user_id: UUID
    images: list[FaceProfileImageResponse]
    image_count: int
    is_complete: bool  # True if 3-5 images
