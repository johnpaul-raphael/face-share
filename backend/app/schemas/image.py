from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    event_id: Optional[UUID] = None  # For event photos
    user_id: Optional[UUID] = None  # For face profile images
    face_image_id: Optional[UUID] = None  # For face profile images


class PresignedUploadResponse(BaseModel):
    upload_url: str
    s3_key: str
    expires_in: int


class PresignedDownloadRequest(BaseModel):
    s3_key: str


class PresignedDownloadResponse(BaseModel):
    download_url: str
    expires_in: int
