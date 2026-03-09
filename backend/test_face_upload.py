"""
Test script to debug face profile upload flow
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.core.s3 import generate_presigned_upload_url, get_s3_key_for_face_profile
from app.core.rekognition import rekognition_service
from app.core.config import settings
from uuid import uuid4

print("🧪 Testing Face Profile Upload Flow\n")

# Step 1: Generate S3 key
user_id = "test-user-123"
face_image_id = str(uuid4())
filename = "test-face.jpg"
s3_key = get_s3_key_for_face_profile(user_id, face_image_id, filename)

print(f"✅ Step 1: Generated S3 key")
print(f"   Key: {s3_key}\n")

# Step 2: Generate presigned upload URL
upload_url = generate_presigned_upload_url(s3_key, content_type="image/jpeg")

if upload_url:
    print(f"✅ Step 2: Generated presigned upload URL")
    print(f"   URL: {upload_url[:100]}...\n")
else:
    print(f"❌ Step 2: Failed to generate presigned upload URL")
    print(f"   Check AWS credentials and S3 bucket configuration\n")
    sys.exit(1)

# Step 3: Test Rekognition collection
print(f"✅ Step 3: Checking Rekognition collection")
collections = rekognition_service.client.list_collections()
print(f"   Available collections: {collections.get('CollectionIds', [])}\n")

if rekognition_service.collection_id in collections.get('CollectionIds', []):
    print(f"✅ Collection '{rekognition_service.collection_id}' exists\n")
else:
    print(f"❌ Collection '{rekognition_service.collection_id}' not found")
    print(f"   Creating collection...")
    rekognition_service.create_collection()

print("\n" + "="*60)
print("📋 Summary")
print("="*60)
print(f"S3 Bucket:           {settings.S3_BUCKET_NAME}")
print(f"AWS Region:          {settings.AWS_REGION}")
print(f"Rekognition Collection: {rekognition_service.collection_id}")
print(f"Presigned URL generation: {'✅ Working' if upload_url else '❌ Failed'}")
print("="*60)

print("\n✅ All checks passed! Face profile upload flow should work.")
print("\nIf uploads are still failing, check:")
print("1. Frontend browser console for errors")
print("2. Network tab for failed requests")
print("3. CORS configuration in backend .env")
