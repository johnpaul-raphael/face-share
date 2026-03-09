# backend/test_s3.py
import sys
sys.path.append('.')

from app.core.s3 import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    get_s3_key_for_photo,
    get_s3_key_for_face_profile
)

# Test profile upload URL
user_id = "test-user-123"
face_image_id = "face-456"
filename = "profile.jpg"

s3_key = get_s3_key_for_face_profile(user_id, face_image_id, filename)
print(f"S3 Key: {s3_key}")

upload_url = generate_presigned_upload_url(s3_key)
print(f"\nProfile Upload URL (valid for 1 hour):\n{upload_url}")

# Test event photo URL
event_id = "event-789"
photo_id = "photo-000"

s3_key = get_s3_key_for_photo(event_id, photo_id, filename)
print(f"\n\nS3 Key: {s3_key}")

upload_url = generate_presigned_upload_url(s3_key)
print(f"Event Upload URL:\n{upload_url}")
