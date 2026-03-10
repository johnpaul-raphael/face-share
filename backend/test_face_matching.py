"""
End-to-end face matching test
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from app.core.rekognition import RekognitionService
from app.core.dynamodb import DynamoDBService
from app.core.config import settings
import uuid


@pytest.mark.skip(reason="Manual/interactive test — requires S3 upload and stdin")
def test_complete_flow():
    """Test complete face matching flow."""
    
    print("\n" + "="*60)
    print("🔗 END-TO-END FACE MATCHING TEST")
    print("="*60)
    
    rekognition = RekognitionService()
    dynamodb = DynamoDBService()
    
    # Step 1: Create user
    print("\n👤 Step 1: Create User")
    user_id = str(uuid.uuid4())
    dynamodb.create_user(
        user_id=user_id,
        email="test@example.com",
        name="Test User"
    )
    
    # Step 2: Index face (assuming photo uploaded to S3)
    print("\n😊 Step 2: Index Face")
    print("⚠️  Make sure you have uploaded a photo to:")
    print(f"   s3://{settings.S3_BUCKET_NAME}/users/{user_id}/profile.jpg")
    
    input("Press Enter after uploading the photo...")
    
    face_result = rekognition.index_face(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key=f"users/{user_id}/profile.jpg",
        external_image_id=user_id
    )
    
    if face_result:
        # Store in DynamoDB
        dynamodb.create_face_profile(
            user_id=user_id,
            image_id=str(uuid.uuid4()),
            s3_key=f"users/{user_id}/profile.jpg",
            embedding=[],  # Rekognition stores this internally
            rekognition_face_id=face_result['face_id']
        )
        print(f"✅ Face indexed: {face_result['face_id']}")
    
    # Step 3: Create event
    print("\n📅 Step 3: Create Event")
    event_id = str(uuid.uuid4())
    dynamodb.create_event(
        event_id=event_id,
        owner_id=user_id,
        name="Test Event"
    )
    
    # Step 4: Upload event photo and find matches
    print("\n📸 Step 4: Process Event Photo")
    print("⚠️  Make sure you have uploaded an event photo to:")
    print(f"   s3://{settings.S3_BUCKET_NAME}/events/{event_id}/photos/001.jpg")
    
    input("Press Enter after uploading the event photo...")
    
    # Detect faces
    faces = rekognition.detect_faces(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key=f"events/{event_id}/photos/001.jpg"
    )
    print(f"✅ Detected {len(faces)} faces in event photo")
    
    # Search for matches
    matches = rekognition.search_faces_by_image(
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_key=f"events/{event_id}/photos/001.jpg"
    )
    
    # Store matches in DynamoDB
    for match in matches:
        match_id = str(uuid.uuid4())
        dynamodb.create_face_match(
            match_id=match_id,
            photo_id="001",
            user_id=match['external_image_id'],
            confidence=match['similarity'] / 100,  # Convert to 0-1 scale
            rekognition_face_id=match['face_id']
        )
        print(f"✅ Stored match: {match['external_image_id']} ({match['similarity']:.1f}%)")
    
    # Step 5: Verify results
    print("\n✅ Step 5: Verify Results")
    user_photos = dynamodb.get_user_photos(user_id)
    print(f"User appears in {len(user_photos)} photos")
    
    print("\n" + "="*60)
    print("🎉 FACE MATCHING FLOW COMPLETE!")
    print("="*60)


if __name__ == "__main__":
    test_complete_flow()
