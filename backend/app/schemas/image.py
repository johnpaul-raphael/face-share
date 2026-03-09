from pydantic import BaseModel
from typing import Optional


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    event_id: Optional[str] = None       # For event photos
    user_id: Optional[str] = None        # For face profile images
    face_image_id: Optional[str] = None  # For face profile images


class PresignedUploadResponse(BaseModel):
    upload_url: str
    s3_key: str
    expires_in: int
    photo_id: Optional[str] = None       # Set when event photo is created
    face_image_id: Optional[str] = None  # Set when face profile upload is prepared


class PresignedDownloadRequest(BaseModel):
    s3_key: str


class PresignedDownloadResponse(BaseModel):
    download_url: str
    expires_in: int


class PhotoResponse(BaseModel):
    photo_id: str
    event_id: str
    uploader_id: str
    s3_key: str
    url: Optional[str] = None  # Presigned download URL
    is_processing: bool = False
    uploaded_at: Optional[str] = None
    match_count: int = 0
