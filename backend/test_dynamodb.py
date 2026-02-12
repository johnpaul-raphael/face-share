"""
Test script for DynamoDB operations
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.dynamodb import DynamoDBService


def test_all_operations():
    """Test all DynamoDB CRUD operations."""
    
    print("\n" + "="*60)
    print("🧪 DYNAMODB CRUD TESTS")
    print("="*60)
    
    db = DynamoDBService()
    
    # Test Users
    print("\n👤 TESTING USERS")
    print("-" * 40)
    
    user_id = "test-user-001"
    db.create_user(
        user_id=user_id,
        email="test@example.com",
        name="Test User"
    )
    
    user = db.get_user_by_id(user_id)
    print(f"✅ Created user: {user['name']}")
    
    # Test Face Profiles
    print("\n😊 TESTING FACE PROFILES")
    print("-" * 40)
    
    db.create_face_profile(
        user_id=user_id,
        image_id="face-001",
        s3_key="users/test/face.jpg",
        embedding=[0.1, 0.2, 0.3]  # Simplified for testing
    )
    
    profiles = db.get_user_face_profiles(user_id)
    print(f"✅ Found {len(profiles)} face profiles")
    
    # Test Events
    print("\n📅 TESTING EVENTS")
    print("-" * 40)
    
    event_id = "test-event-001"
    db.create_event(
        event_id=event_id,
        owner_id=user_id,
        name="Test Event"
    )
    
    event = db.get_event(event_id)
    print(f"✅ Created event: {event['name']}")
    
    # Test Participants
    print("\n👥 TESTING PARTICIPANTS")
    print("-" * 40)
    
    db.add_event_participant(
        event_id=event_id,
        user_id=user_id,
        status="confirmed"
    )
    
    participants = db.get_event_participants(event_id)
    print(f"✅ Found {len(participants)} participants")
    
    # Test Photos
    print("\n📸 TESTING PHOTOS")
    print("-" * 40)
    
    photo_id = "test-photo-001"
    db.create_photo(
        photo_id=photo_id,
        event_id=event_id,
        uploader_id=user_id,
        s3_key="events/test/photo.jpg"
    )
    
    photos = db.get_event_photos(event_id)
    print(f"✅ Found {len(photos)} photos")
    
    # Test Face Matches
    print("\n🎯 TESTING FACE MATCHES")
    print("-" * 40)
    
    db.create_face_match(
        match_id="match-001",
        photo_id=photo_id,
        user_id=user_id,
        confidence=0.95
    )
    
    matches = db.get_photo_matches(photo_id)
    print(f"✅ Found {len(matches)} face matches")
    
    # Test GSI Queries
    print("\n🔍 TESTING GSI QUERIES")
    print("-" * 40)
    
    user_events = db.get_user_events(user_id)
    print(f"✅ User owns {len(user_events)} events")
    
    user_photos = db.get_user_photos(user_id)
    print(f"✅ User appears in {len(user_photos)} photos")
    
    print("\n" + "="*60)
    print("✅ ALL TESTS COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    test_all_operations()
