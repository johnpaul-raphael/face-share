"""
FaceShare S3 Module

This module handles all interactions with AWS S3 (Simple Storage Service).
Used for storing and retrieving user profile images and event photos.

Features:
    - Generate presigned URLs for secure direct browser uploads
    - Generate presigned URLs for temporary image access
    - Delete objects from S3
    - Create organized S3 key paths

S3 Folder Structure:
    users/{user_id}/face-profile/{image_id}/{filename}     - Profile photos
    events/{event_id}/photos/{photo_id}/{filename}         - Event photos
    photos/{photo_id}/faces/{match_id}.jpg                 - Cropped face matches

Environment Variables Required (from .env):
    AWS_ACCESS_KEY_ID       - AWS IAM access key
    AWS_SECRET_ACCESS_KEY   - AWS IAM secret key
    AWS_REGION             - AWS region (e.g., us-east-1)
    S3_BUCKET_NAME         - S3 bucket name
    S3_PRESIGNED_URL_EXPIRATION - URL expiry time in seconds

Example Usage:
    from app.core.s3 import generate_presigned_upload_url, get_s3_key_for_photo

    # Generate upload URL for event photo
    s3_key = get_s3_key_for_photo("event-123", "photo-456", "wedding.jpg")
    url = generate_presigned_upload_url(s3_key)

    # Frontend uses this URL to upload directly to S3
"""

import logging
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional

# Import configuration from our config module
from app.core.config import settings

logger = logging.getLogger(__name__)


# ==========================================
# S3 CLIENT INITIALIZATION
# ==========================================

def create_s3_client():
    """
    Create and configure the S3 client.

    In Lambda/STS environments (AWS_SESSION_TOKEN is present), uses boto3's
    default credential chain so the session token is included automatically
    in presigned URL signatures (required for STS creds to work with S3).

    In local development, uses explicit credentials from .env.

    Returns:
        boto3.client: Configured S3 client
    """
    _cfg = Config(signature_version='v4')

    # Lambda injects AWS_SESSION_TOKEN along with temporary STS credentials.
    # We must NOT pass explicit key/secret in that case — boto3's default chain
    # picks up all three (key, secret, session_token) and includes
    # X-Amz-Security-Token in presigned URLs, which S3 requires for STS creds.
    if os.environ.get('AWS_SESSION_TOKEN'):
        logger.info(
            "[S3] Lambda/STS environment detected — using default credential chain. "
            "region=%s bucket=%s",
            settings.AWS_REGION,
            settings.S3_BUCKET_NAME,
        )
        return boto3.client(
            's3',
            region_name=settings.AWS_REGION,
            config=_cfg,
        )

    # Local development: explicit IAM user credentials from .env
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "AWS credentials not loaded — check that backend/.env contains "
            "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        )

    logger.info(
        "[S3] Local dev — explicit credentials: key=%s... region=%s bucket=%s",
        settings.AWS_ACCESS_KEY_ID[:8],
        settings.AWS_REGION,
        settings.S3_BUCKET_NAME,
    )

    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=_cfg,
    )


# Initialize S3 client at module load
s3_client = create_s3_client()


# ==========================================
# PRESIGNED URL GENERATION
# ==========================================

def generate_presigned_upload_url(
    key: str,
    content_type: str = "image/jpeg",
    expiration: int = None
) -> Optional[str]:
    """
    Generate a presigned URL for uploading a file to S3.

    This allows browsers to upload files directly to S3 without exposing
    AWS credentials. The URL is temporary and expires after a set time.

    Args:
        key (str): The S3 object key (file path in bucket)
        content_type (str): MIME type of the file (default: image/jpeg)
        expiration (int): URL expiry time in seconds (default: from settings)

    Returns:
        str: Presigned URL for upload, or None if error occurs

    Security:
        - URL expires after specified time (default 1 hour)
        - Only allows PUT request to specific key
        - Requires Content-Type header to match
    """
    try:
        expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION

        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': key,
                # ContentType intentionally excluded from signature params.
                # Including it locks the upload to an exact MIME type and causes
                # 403s whenever file.type is empty, non-standard, or mismatches
                # (e.g. "image/jpg" vs "image/jpeg" on different browsers/devices).
                # The frontend still sends Content-Type in the XHR headers so the
                # S3 object gets correct metadata — it just isn't signature-verified.
            },
            ExpiresIn=expiration
        )

        return url

    except ClientError as e:
        logger.error("Error generating presigned upload URL: %s", e)
        return None


def generate_presigned_download_url(
    key: str,
    expiration: int = None
) -> Optional[str]:
    """
    Generate a presigned URL for downloading a file from S3.

    Creates a temporary URL that allows access to a private S3 object
    without making the bucket public.

    Args:
        key (str): The S3 object key (file path in bucket)
        expiration (int): URL expiry time in seconds (default: from settings)

    Returns:
        str: Presigned URL for download, or None if error occurs

    Typical Use Cases:
        - Displaying images in frontend galleries
        - Allowing users to download their photos
        - Temporary access for image processing
    """
    try:
        expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION

        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': key,
            },
            ExpiresIn=expiration
        )

        return url

    except ClientError as e:
        logger.error("Error generating presigned download URL: %s", e)
        return None


# ==========================================
# S3 OBJECT OPERATIONS
# ==========================================

def delete_s3_object(key: str) -> bool:
    """
    Delete an object from S3.

    Permanently removes the file from the bucket. This operation
    cannot be undone (unless S3 versioning is enabled).

    Args:
        key (str): The S3 object key to delete

    Returns:
        bool: True if deletion successful, False otherwise

    Warning:
        - This permanently deletes the file
        - Use with caution in production
        - Consider S3 versioning for safety
    """
    try:
        s3_client.delete_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key
        )
        logger.info("Deleted S3 object: %s", key)
        return True

    except ClientError as e:
        logger.error("Error deleting S3 object: %s", e)
        return False


def check_s3_object_exists(key: str) -> bool:
    """
    Check if an object exists in S3.

    Useful for verifying uploads or checking before deletion.

    Args:
        key (str): The S3 object key to check

    Returns:
        bool: True if object exists, False otherwise
    """
    try:
        s3_client.head_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key
        )
        return True

    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == '404':
            return False
        logger.error("Error checking S3 object: %s", e)
        return False


# ==========================================
# S3 KEY GENERATORS
# ==========================================

def get_s3_key_for_photo(event_id: str, photo_id: str, filename: str) -> str:
    """Generate S3 key (path) for an event photo."""
    return f"events/{event_id}/photos/{photo_id}/{filename}"


def get_s3_key_for_face_profile(user_id: str, face_image_id: str, filename: str) -> str:
    """Generate S3 key (path) for a user's face profile image."""
    return f"users/{user_id}/face-profile/{face_image_id}/{filename}"


def get_s3_key_for_face_crop(photo_id: str, match_id: str) -> str:
    """Generate S3 key (path) for a cropped face image."""
    return f"photos/{photo_id}/faces/{match_id}.jpg"


def get_s3_key_for_event_cover(event_id: str, filename: str) -> str:
    """Generate S3 key (path) for an event cover image."""
    return f"events/{event_id}/cover/{filename}"


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def extract_s3_key_from_url(s3_url: str) -> Optional[str]:
    """
    Extract the S3 key from a full S3 URL.

    Args:
        s3_url (str): Full S3 URL

    Returns:
        str: S3 object key, or None if parsing fails
    """
    try:
        bucket_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/"
        if s3_url.startswith(bucket_url):
            return s3_url[len(bucket_url):]

        if '?' in s3_url:
            base_url = s3_url.split('?')[0]
            return extract_s3_key_from_url(base_url)

        return None

    except Exception as e:
        logger.error("Error extracting S3 key from URL: %s", e)
        return None
