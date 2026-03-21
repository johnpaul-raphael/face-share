from pydantic import BaseModel, field_validator
from typing import Optional

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
}
MAX_EVENT_PHOTO_BYTES = 30 * 1024 * 1024   # 30 MB — covers DSLR JPEGs and high-res phones
MAX_FACE_PROFILE_BYTES = 15 * 1024 * 1024  # 15 MB — face profile images don't need to be huge


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
    file_size: Optional[int] = None      # bytes — validated against per-context limits

    @field_validator("content_type", mode="before")
    @classmethod
    def normalise_content_type(cls, v: str) -> str:
        """Treat empty / missing content_type as image/jpeg, and normalise
        non-standard variants so the presigned URL and upload always agree."""
        if not v:
            return "image/jpeg"
        v = v.lower().strip()
        # 'image/jpg' is non-standard; AWS stores it as 'image/jpeg'
        if v == "image/jpg":
            return "image/jpeg"
        return v

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v not in ALLOWED_IMAGE_TYPES:
            raise ValueError(
                f"Unsupported file type '{v}'. Allowed: JPEG, PNG, WebP, HEIC."
            )
        return v

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
    url: Optional[str] = None           # Presigned download URL (full resolution)
    thumbnail_url: Optional[str] = None  # Presigned download URL (400px thumbnail)
    is_processing: bool = False
    uploaded_at: Optional[str] = None
    match_count: int = 0


class FaceMatchResponse(BaseModel):
    match_id: str
    photo_id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    confidence: float
    is_confirmed: bool = False
    created_at: Optional[str] = None
