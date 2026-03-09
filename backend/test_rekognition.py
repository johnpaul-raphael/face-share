"""
Run this from the backend/ directory:
    python test_rekognition.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings

print(f"\n{'='*60}")
print("Rekognition Debug Test")
print(f"{'='*60}")
print(f"Region:      {settings.AWS_REGION}")
print(f"Bucket:      {settings.S3_BUCKET_NAME}")
print(f"Collection:  {settings.REKOGNITION_COLLECTION_ID}")
print(f"Access Key:  {settings.AWS_ACCESS_KEY_ID[:8]}..." if settings.AWS_ACCESS_KEY_ID else "Access Key:  NOT SET")
print(f"{'='*60}\n")

import boto3
from botocore.exceptions import ClientError

client = boto3.client(
    'rekognition',
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)

s3 = boto3.client(
    's3',
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)

S3_BUCKET = settings.S3_BUCKET_NAME
S3_KEY = "users/fe545c99-4945-4e23-9c32-eff99e6fb5ba/face-profile/ce73b2ca-4ee2-421e-bcdf-1d9e31b90eca/vijay.jpg"
COLLECTION = settings.REKOGNITION_COLLECTION_ID

# Step 1: Check S3 object exists
print("Step 1: Checking S3 object...")
try:
    head = s3.head_object(Bucket=S3_BUCKET, Key=S3_KEY)
    size_kb = head['ContentLength'] / 1024
    print(f"  OK  size={size_kb:.1f} KB  ContentType={head.get('ContentType')}\n")
except ClientError as e:
    print(f"  FAIL  {e}\n")
    sys.exit(1)

# Step 2: detect_faces (does not need a collection)
print("Step 2: detect_faces (basic face detection)...")
try:
    resp = client.detect_faces(
        Image={'S3Object': {'Bucket': S3_BUCKET, 'Name': S3_KEY}},
        Attributes=['DEFAULT'],
    )
    faces = resp.get('FaceDetails', [])
    if faces:
        for i, f in enumerate(faces):
            print(f"  Face {i+1}: confidence={f['Confidence']:.1f}%  bbox={f['BoundingBox']}")
        print()
    else:
        print("  NO FACES FOUND by detect_faces\n")
except ClientError as e:
    print(f"  ERROR  {e}\n")

# Step 3: Ensure collection exists
print(f"Step 3: Rekognition collection '{COLLECTION}'...")
try:
    client.create_collection(CollectionId=COLLECTION)
    print("  Created collection\n")
except ClientError as e:
    if 'ResourceAlreadyExistsException' in str(e):
        print("  Collection already exists\n")
    else:
        print(f"  ERROR  {e}\n")

# Step 4: index_faces
print("Step 4: index_faces...")
try:
    resp = client.index_faces(
        CollectionId=COLLECTION,
        Image={'S3Object': {'Bucket': S3_BUCKET, 'Name': S3_KEY}},
        ExternalImageId='debug-test',
        DetectionAttributes=['DEFAULT'],
        MaxFaces=1,
        QualityFilter='NONE',
    )
    face_records = resp.get('FaceRecords', [])
    unindexed    = resp.get('UnindexedFaces', [])
    print(f"  FaceRecords={len(face_records)}  UnindexedFaces={len(unindexed)}")
    if face_records:
        face = face_records[0]['Face']
        print(f"  SUCCESS  FaceId={face['FaceId']}  confidence={face['Confidence']:.1f}%")
    elif unindexed:
        for uf in unindexed:
            print(f"  REJECTED  reasons={uf.get('Reasons', [])}")
    else:
        print("  NO FACE DETECTED")
except ClientError as e:
    print(f"  ERROR  {e}")

print(f"\n{'='*60}\n")
