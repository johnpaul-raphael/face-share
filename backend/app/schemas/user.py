from pydantic import BaseModel, EmailStr
from typing import Optional


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
    id: str
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class FaceProfileImageBase(BaseModel):
    description: Optional[str] = None


class FaceProfileImageCreate(FaceProfileImageBase):
    pass


class FaceProfileImageResponse(FaceProfileImageBase):
    id: str
    s3_key: str
    url: Optional[str] = None  # Presigned URL
    created_at: Optional[str] = None


class FaceProfileResponse(BaseModel):
    user_id: str
    images: list[FaceProfileImageResponse]
    image_count: int
    is_complete: bool  # True if 3-5 images
