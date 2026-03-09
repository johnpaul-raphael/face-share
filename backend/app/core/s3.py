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

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional

# Import configuration from our config module
from app.core.config import settings


# ==========================================
# S3 CLIENT INITIALIZATION
# ==========================================

def create_s3_client():
    """
    Create and configure the S3 client.
    
    Uses credentials from environment (.env file).
    Configures region and signature version for security.
    
    Returns:
        boto3.client: Configured S3 client
    """
    # Configure boto3 with our AWS region
    boto_config = Config(
        region_name=settings.AWS_REGION,
        signature_version='v4',  # AWS Signature Version 4 (most secure)
    )
    
    # Create S3 client using credentials from settings
    # Settings are loaded from .env file via config.py
    client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=boto_config,
    )
    
    return client


# Initialize S3 client at module load
# This will use the environment file selected by config.py
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
    
    Example:
        >>> key = "users/123/face-profile/456/photo.jpg"
        >>> url = generate_presigned_upload_url(key)
        >>> print(url)
        'https://bucket.s3.amazonaws.com/users/123/...?X-Amz-Algorithm=...'
    
    Security:
        - URL expires after specified time (default 1 hour)
        - Only allows PUT request to specific key
        - Requires Content-Type header to match
    """
    try:
        # Use default expiration from settings if not specified
        expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION
        
        # Generate presigned URL for PUT operation
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': key,
                'ContentType': content_type,
            },
            ExpiresIn=expiration
        )
        
        return url
        
    except ClientError as e:
        # Log error and return None if generation fails
        print(f"[ERROR] Error generating presigned upload URL: {e}")
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
    
    Example:
        >>> key = "events/789/photos/000/wedding.jpg"
        >>> url = generate_presigned_download_url(key)
        >>> # URL can be used in <img src="..."> or downloaded
    
    Typical Use Cases:
        - Displaying images in frontend galleries
        - Allowing users to download their photos
        - Temporary access for image processing
    """
    try:
        # Use default expiration from settings if not specified
        expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION
        
        # Generate presigned URL for GET operation
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
        # Log error and return None if generation fails
        print(f"[ERROR] Error generating presigned download URL: {e}")
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
    
    Example:
        >>> success = delete_s3_object("events/old/photo.jpg")
        >>> if success:
        ...     print("File deleted")
    
    Warning:
        - This permanently deletes the file
        - Use with caution in production
        - Consider S3 versioning for safety
    """
    try:
        # Delete the object from S3
        s3_client.delete_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key
        )
        print(f"[OK] Deleted S3 object: {key}")
        return True
        
    except ClientError as e:
        # Log error and return False if deletion fails
        print(f"[ERROR] Error deleting S3 object: {e}")
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
        if e.response['Error']['Code'] == '404':
            return False
        print(f"[ERROR] Error checking S3 object: {e}")
        return False


# ==========================================
# S3 KEY GENERATORS
# ==========================================
# These functions create organized folder paths for S3 objects

def get_s3_key_for_photo(event_id: str, photo_id: str, filename: str) -> str:
    """
    Generate S3 key (path) for an event photo.
    
    Folder Structure:
        events/{event_id}/photos/{photo_id}/{filename}
    
    Args:
        event_id (str): UUID of the event
        photo_id (str): UUID of the photo
        filename (str): Original filename (e.g., "wedding.jpg")
    
    Returns:
        str: S3 object key
    
    Example:
        >>> get_s3_key_for_photo("evt-123", "pic-456", "photo.jpg")
        'events/evt-123/photos/pic-456/photo.jpg'
    """
    return f"events/{event_id}/photos/{photo_id}/{filename}"


def get_s3_key_for_face_profile(user_id: str, face_image_id: str, filename: str) -> str:
    """
    Generate S3 key (path) for a user's face profile image.
    
    Folder Structure:
        users/{user_id}/face-profile/{face_image_id}/{filename}
    
    Args:
        user_id (str): UUID of the user
        face_image_id (str): UUID of the face profile image
        filename (str): Original filename (e.g., "profile.jpg")
    
    Returns:
        str: S3 object key
    
    Example:
        >>> get_s3_key_for_face_profile("usr-123", "face-456", "me.jpg")
        'users/usr-123/face-profile/face-456/me.jpg'
    """
    return f"users/{user_id}/face-profile/{face_image_id}/{filename}"


def get_s3_key_for_face_crop(photo_id: str, match_id: str) -> str:
    """
    Generate S3 key (path) for a cropped face image.
    
    These are generated when face recognition finds a match
    and we want to save just the face portion.
    
    Folder Structure:
        photos/{photo_id}/faces/{match_id}.jpg
    
    Args:
        photo_id (str): UUID of the parent photo
        match_id (str): UUID of the face match
    
    Returns:
        str: S3 object key
    
    Example:
        >>> get_s3_key_for_face_crop("pic-123", "match-456")
        'photos/pic-123/faces/match-456.jpg'
    """
    return f"photos/{photo_id}/faces/{match_id}.jpg"


def get_s3_key_for_event_cover(event_id: str, filename: str) -> str:
    """
    Generate S3 key (path) for an event cover image.
    
    Folder Structure:
        events/{event_id}/cover/{filename}
    
    Args:
        event_id (str): UUID of the event
        filename (str): Original filename
    
    Returns:
        str: S3 object key
    """
    return f"events/{event_id}/cover/{filename}"


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def extract_s3_key_from_url(s3_url: str) -> Optional[str]:
    """
    Extract the S3 key from a full S3 URL.
    
    Useful when you have a full URL and need just the key portion.
    
    Args:
        s3_url (str): Full S3 URL
    
    Returns:
        str: S3 object key, or None if parsing fails
    
    Example:
        >>> url = "https://bucket.s3.amazonaws.com/events/123/photo.jpg"
        >>> extract_s3_key_from_url(url)
        'events/123/photo.jpg'
    """
    try:
        # Remove the bucket URL portion
        bucket_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/"
        if s3_url.startswith(bucket_url):
            return s3_url[len(bucket_url):]
        
        # Handle presigned URLs (with query parameters)
        if '?' in s3_url:
            base_url = s3_url.split('?')[0]
            return extract_s3_key_from_url(base_url)
        
        return None
        
    except Exception as e:
        print(f"[ERROR] Error extracting S3 key from URL: {e}")
        return None


# ==========================================
# DEBUG / TESTING
# ==========================================

if __name__ == "__main__":
    """
    Run this file directly to test S3 configuration:
    
    python -m app.core.s3
    """
    print("[CONFIG] Testing S3 Configuration...")
    print(f"Bucket: {settings.S3_BUCKET_NAME}")
    print(f"Region: {settings.AWS_REGION}")
    print(f"Environment: {settings.ENVIRONMENT}")
    
    # Test key generation
    test_key = get_s3_key_for_photo("test-event", "test-photo", "test.jpg")
    print(f"\nTest S3 Key: {test_key}")
    
    # Test presigned URL generation (will fail without valid AWS credentials)
    print("\nGenerating test presigned URL...")
    url = generate_presigned_upload_url(test_key)
    
    if url:
        print("[OK] Success! URL generated (first 100 chars):")
        print(f"{url[:100]}...")
    else:
        print("[ERROR] Failed to generate URL")
        print("Check your AWS credentials in .env file")