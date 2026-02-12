"""
Test script for AWS Rekognition integration
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.rekognition import RekognitionService
from app.core.config import settings


def test_rekognition():
    """Test all Rekognition operations."""
    
    print("\n" + "="*60)
    print("🎭 AWS REKOGNITION TESTS")
    print("="*60)
    
    rekognition = RekognitionService()
    
    # Test 1: Create collection
    print("\n📦 TEST 1: Create Collection")
    print("-" * 40)
    success = rekognition.create_collection()
    if success:
        print("✅ Collection ready")
    
    # Test 2: List faces (should be empty)
    print("\n📋 TEST 2: List Faces")
    print("-" * 40)
    faces = rekognition.list_faces()
    print(f"ℹ️  Collection has {len(faces)} faces")
    
    # Test 3: Detect faces
    detected = rekognition.detect_faces(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key="test/events/event-001/photo-001.jpg"
    )
    print(f"✅ Detected {len(detected)} faces")
    for i, face in enumerate(detected):
        print(f"   Face {i+1}: Confidence {face['confidence']:.2f}%")
        print(f"      Bounding box: {face['bounding_box']}")

    
    # Test 4: Index face (after upload)
    print("\n💾 TEST 4: Index Face")
    print("-" * 40)
    result = rekognition.index_face(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key="test/profiles/user-001.jpg",
        external_image_id="user-001"
    )
    if result:
        print(f"✅ Indexed face: {result['face_id']}")
        print(f"   External ID: {result['external_image_id']}")
        print(f"   Confidence: {result['confidence']:.2f}%")
    
    # Test 5: Search faces (after indexing)
    print("\n🎯 TEST 5: Search Faces")
    print("-" * 40)
    
    # Uncomment after indexing:
    matches = rekognition.search_faces_by_image(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key="test/events/event-001/photo-003.jpg",
        threshold=90.0  # 90% similarity minimum
    )
    print(f"✅ Found {len(matches)} matches")
    for match in matches:
        print(f"   - User: {match['external_image_id']}")
        print(f"     Similarity: {match['similarity']:.2f}%")
        print(f"     Face ID: {match['face_id']}")
    
    print("\n" + "="*60)
    print("✅ REKOGNITION SETUP COMPLETE")
    print("="*60)
    print("\n📋 NEXT STEPS:")
    print("1. Upload a test face image to S3")
    print("2. Run index_face() to add to collection")
    print("3. Upload an event photo")
    print("4. Run search_faces_by_image() to find matches")


if __name__ == "__main__":
    test_rekognition()
