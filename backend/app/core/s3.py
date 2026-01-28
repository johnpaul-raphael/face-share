import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional
from app.core.config import settings

# Configure boto3 client
boto_config = Config(
    region_name=settings.AWS_REGION,
    signature_version='v4',
)

s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    config=boto_config,
)


def generate_presigned_upload_url(
    key: str,
    content_type: str = "image/jpeg",
    expiration: int = None
) -> Optional[str]:
    """
    Generate a presigned URL for uploading to S3.
    
    Args:
        key: S3 object key (path)
        content_type: MIME type of the file
        expiration: URL expiration time in seconds (defaults to config value)
    
    Returns:
        Presigned URL string or None if error
    """
    try:
        expiration = expiration or settings.S3_PRESIGNED_URL_EXPIRATION
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
        print(f"Error generating presigned upload URL: {e}")
        return None


def generate_presigned_download_url(
    key: str,
    expiration: int = None
) -> Optional[str]:
    """
    Generate a presigned URL for downloading from S3.
    
    Args:
        key: S3 object key (path)
        expiration: URL expiration time in seconds (defaults to config value)
    
    Returns:
        Presigned URL string or None if error
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
        print(f"Error generating presigned download URL: {e}")
        return None


def delete_s3_object(key: str) -> bool:
    """
    Delete an object from S3.
    
    Args:
        key: S3 object key (path)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        s3_client.delete_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key
        )
        return True
    except ClientError as e:
        print(f"Error deleting S3 object: {e}")
        return False


def get_s3_key_for_photo(event_id: str, photo_id: str, filename: str) -> str:
    """Generate S3 key for a photo."""
    return f"events/{event_id}/photos/{photo_id}/{filename}"


def get_s3_key_for_face_profile(user_id: str, face_image_id: str, filename: str) -> str:
    """Generate S3 key for a face profile image."""
    return f"users/{user_id}/face-profile/{face_image_id}/{filename}"


def get_s3_key_for_face_crop(photo_id: str, match_id: str) -> str:
    """Generate S3 key for a cropped face image."""
    return f"photos/{photo_id}/faces/{match_id}.jpg"
