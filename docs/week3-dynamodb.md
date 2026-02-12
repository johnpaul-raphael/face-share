# Week 3: DynamoDB NoSQL Database

> **Difficulty**: Intermediate | **Time**: 4-5 hours | **Cost**: $0 (Free Tier - 25GB)

## 🎯 Learning Objectives

By the end of this week, you will:
- ✅ Understand NoSQL vs SQL differences
- ✅ Design single-table DynamoDB architecture
- ✅ Implement partition keys (PK) and sort keys (SK)
- ✅ Create Global Secondary Indexes (GSIs)
- ✅ Build CRUD operations for all entities
- ✅ Migrate from PostgreSQL to DynamoDB

---

## 🏗️ Architecture Overview

```mermaid
erDiagram
    DYNAMODB_TABLE {
        string PK "Partition Key"
        string SK "Sort Key"
        string GSI1PK "GSI Partition Key"
        string GSI1SK "GSI Sort Key"
        map attributes "Entity Data"
    }
    
    DYNAMODB_TABLE ||--o{ USER : contains
    DYNAMODB_TABLE ||--o{ FACE_PROFILE : contains
    DYNAMODB_TABLE ||--o{ EVENT : contains
    DYNAMODB_TABLE ||--o{ PHOTO : contains
    DYNAMODB_TABLE ||--o{ FACE_MATCH : contains
    
    USER ||--o{ FACE_PROFILE : has
    USER ||--o{ EVENT : owns
    EVENT ||--o{ PHOTO : contains
    PHOTO ||--o{ FACE_MATCH : has
```

### Single-Table Design Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                  DYNAMODB SINGLE-TABLE DESIGN                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PK (Partition Key)    SK (Sort Key)            Attributes      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  USER#123             PROFILE                    name, email    │
│  USER#123             FACE#456                   s3_key, emb    │
│  USER#123             FACE#789                   s3_key, emb    │
│                                                                  │
│  EVENT#456            METADATA                   name, owner    │
│  EVENT#456            USER#123                   status: pending│
│  EVENT#456            USER#789                   status: confirmed│
│  EVENT#456            PHOTO#001                  s3_key         │
│  EVENT#456            PHOTO#002                  s3_key         │
│                                                                  │
│  PHOTO#001            MATCH#A                    user_id, conf  │
│  PHOTO#001            MATCH#B                    user_id, conf  │
│                                                                  │
│  GSI1 (Global Secondary Index):                                 │
│  ─────────────────────────────────────────────────────────────  │
│  GSI1PK               GSI1SK                     Attributes     │
│  EMAIL#test@email.com USER#123                   (user data)    │
│  USER#123             EVENT#456                  (participation)│
│  USER#123             MATCH#A                    (photo match)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Access Patterns Supported**:
1. Get user by ID → Query PK=USER#123
2. Get user's faces → Query PK=USER#123, SK starts with FACE#
3. Get event by ID → Query PK=EVENT#456, SK=METADATA
4. Get event participants → Query PK=EVENT#456, SK starts with USER#
5. Get event photos → Query PK=EVENT#456, SK starts with PHOTO#
6. Get photo matches → Query PK=PHOTO#001
7. Get user by email → GSI: GSI1PK=EMAIL#test@email.com
8. Get user's events → GSI: GSI1PK=USER#123, GSI1SK starts with EVENT#
9. Get user's photos → GSI: GSI1PK=USER#123, GSI1SK starts with MATCH#

---

## 🤔 Why DynamoDB (vs PostgreSQL)?

### The Problem with PostgreSQL/RDS
| Issue | Impact |
|-------|--------|
| Server management | Patches, scaling, backups |
| Connection limits | Max ~100 connections |
| Slow at scale | JOINs get expensive |
| Cost | $15-50/month minimum |
| Scaling | Manual read replicas |

### Why DynamoDB Wins

| Feature | Benefit | Cost Impact |
|---------|---------|-------------|
| **Serverless** | No servers to manage | Save ops time |
| **Auto-scaling** | 0 to millions of requests | Pay only for use |
| **Single-digit ms** | Consistent performance | Better UX |
| **Unlimited scale** | No connection limits | Future-proof |
| **Free tier** | 25GB + 200M requests/month | $0 to start |

### When to Use What?

| Use Case | Choose |
|----------|--------|
| Complex joins, transactions | PostgreSQL |
| Simple queries, high scale | DynamoDB |
| Serverless architecture | DynamoDB |
| Cost-sensitive, variable load | DynamoDB |

---

## 📋 Implementation Steps

### Step 1: Create DynamoDB Table

#### Using AWS CLI

```bash
# Create table with PK and SK
aws dynamodb create-table \
    --table-name FaceShareData \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSI1PK,AttributeType=S \
        AttributeName=GSI1SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 5,
                    "WriteCapacityUnits": 5
                }
            }
        ]' \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

**What this creates**:
- **Table**: FaceShareData
- **Primary Key**: PK (partition) + SK (sort)
- **GSI**: GSI1PK + GSI1SK for alternate queries
- **Billing**: On-demand (pay-per-request, $0 at low scale)

**Verify table created**:
```bash
aws dynamodb describe-table --table-name FaceShareData
```

### Step 2: Create DynamoDB Service Layer

Create `backend/app/core/dynamodb.py`:

```python
"""
FaceShare DynamoDB Service

Implements single-table design pattern for all entities.
"""

import boto3
from botocore.exceptions import ClientError
from typing import Optional, List, Dict, Any
from decimal import Decimal
import uuid
from datetime import datetime

from app.core.config import settings


class DynamoDBService:
    """
    Service for DynamoDB operations using single-table design.
    
    Table Schema:
    - PK: Partition Key (USER#<id>, EVENT#<id>, PHOTO#<id>)
    - SK: Sort Key (PROFILE, FACE#<id>, METADATA, etc.)
    - GSI1PK/GSI1SK: Global Secondary Index for alternate access
    """
    
    def __init__(self):
        """Initialize DynamoDB client."""
        self.resource = boto3.resource(
            'dynamodb',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.client = boto3.client(
            'dynamodb',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.table_name = 'FaceShareData'
        self.table = self.resource.Table(self.table_name)
    
    # ==========================================
    # USER OPERATIONS
    # ==========================================
    
    def create_user(self, user_id: str, email: str, name: str, 
                   hashed_password: str, **kwargs) -> bool:
        """
        Create a new user.
        
        Args:
            user_id: UUID of user
            email: User's email (unique)
            name: User's full name
            hashed_password: Bcrypt hashed password
        """
        try:
            item = {
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE',
                'GSI1PK': f'EMAIL#{email.lower()}',
                'GSI1SK': f'USER#{user_id}',
                'user_id': user_id,
                'email': email,
                'name': name,
                'hashed_password': hashed_password,
                'entity_type': 'USER',
                'created_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            # Remove None values
            item = {k: v for k, v in item.items() if v is not None}
            
            self.table.put_item(Item=item)
            print(f"✅ Created user: {user_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error creating user: {e}")
            return False
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by ID."""
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': 'PROFILE'
                }
            )
            return response.get('Item')
        except ClientError as e:
            print(f"❌ Error getting user: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email using GSI."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :email',
                ExpressionAttributeValues={
                    ':email': f'EMAIL#{email.lower()}'
                }
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except ClientError as e:
            print(f"❌ Error getting user by email: {e}")
            return None
    
    def update_user(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update user attributes."""
        try:
            # Build update expression
            update_expr = 'SET '
            expr_values = {}
            expr_names = {}
            
            for i, (key, value) in enumerate(updates.items()):
                placeholder = f'#f{i}'
                value_placeholder = f':v{i}'
                update_expr += f'{placeholder} = {value_placeholder}, '
                expr_names[placeholder] = key
                expr_values[value_placeholder] = value
            
            update_expr = update_expr.rstrip(', ')
            
            self.table.update_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': 'PROFILE'
                },
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values
            )
            return True
            
        except ClientError as e:
            print(f"❌ Error updating user: {e}")
            return False
    
    # ==========================================
    # FACE PROFILE OPERATIONS
    # ==========================================
    
    def create_face_profile(self, user_id: str, image_id: str,
                           s3_key: str, rekognition_face_id: str = None,
                           **kwargs) -> bool:
        """Create a face profile for user."""
        try:
            item = {
                'PK': f'USER#{user_id}',
                'SK': f'FACE#{image_id}',
                'user_id': user_id,
                'image_id': image_id,
                's3_key': s3_key,
                'rekognition_face_id': rekognition_face_id,
                'entity_type': 'FACE_PROFILE',
                'created_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            item = {k: v for k, v in item.items() if v is not None}
            
            self.table.put_item(Item=item)
            print(f"✅ Created face profile: {image_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error creating face profile: {e}")
            return False
    
    def get_user_face_profiles(self, user_id: str) -> List[Dict]:
        """Get all face profiles for a user."""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'FACE#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting face profiles: {e}")
            return []
    
    def delete_face_profile(self, user_id: str, image_id: str) -> bool:
        """Delete a face profile."""
        try:
            self.table.delete_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'FACE#{image_id}'
                }
            )
            print(f"✅ Deleted face profile: {image_id}")
            return True
        except ClientError as e:
            print(f"❌ Error deleting face profile: {e}")
            return False
    
    # ==========================================
    # EVENT OPERATIONS
    # ==========================================
    
    def create_event(self, event_id: str, owner_id: str, name: str,
                     description: str = None, join_code: str = None,
                     **kwargs) -> bool:
        """Create a new event."""
        try:
            item = {
                'PK': f'EVENT#{event_id}',
                'SK': 'METADATA',
                'GSI1PK': f'USER#{owner_id}',
                'GSI1SK': f'EVENT#{event_id}',
                'event_id': event_id,
                'owner_id': owner_id,
                'name': name,
                'description': description,
                'join_code': join_code,
                'entity_type': 'EVENT',
                'created_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            item = {k: v for k, v in item.items() if v is not None}
            
            self.table.put_item(Item=item)
            print(f"✅ Created event: {event_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error creating event: {e}")
            return False
    
    def get_event(self, event_id: str) -> Optional[Dict]:
        """Get event by ID."""
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'EVENT#{event_id}',
                    'SK': 'METADATA'
                }
            )
            return response.get('Item')
        except ClientError as e:
            print(f"❌ Error getting event: {e}")
            return None
    
    def get_user_events(self, user_id: str) -> List[Dict]:
        """Get all events owned by user."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'EVENT#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting user events: {e}")
            return []
    
    # ==========================================
    # EVENT PARTICIPANT OPERATIONS
    # ==========================================
    
    def add_event_participant(self, event_id: str, user_id: str,
                              status: str = 'pending', **kwargs) -> bool:
        """Add a participant to an event."""
        try:
            item = {
                'PK': f'EVENT#{event_id}',
                'SK': f'USER#{user_id}',
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'EVENT#{event_id}',
                'event_id': event_id,
                'user_id': user_id,
                'status': status,
                'entity_type': 'PARTICIPANT',
                'joined_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            self.table.put_item(Item=item)
            print(f"✅ Added participant {user_id} to event {event_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error adding participant: {e}")
            return False
    
    def get_event_participants(self, event_id: str) -> List[Dict]:
        """Get all participants for an event."""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'EVENT#{event_id}',
                    ':sk': 'USER#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting participants: {e}")
            return []
    
    def update_participant_status(self, event_id: str, user_id: str,
                                  status: str) -> bool:
        """Update participant status."""
        try:
            self.table.update_item(
                Key={
                    'PK': f'EVENT#{event_id}',
                    'SK': f'USER#{user_id}'
                },
                UpdateExpression='SET #st = :status',
                ExpressionAttributeNames={'#st': 'status'},
                ExpressionAttributeValues={':status': status}
            )
            return True
        except ClientError as e:
            print(f"❌ Error updating participant: {e}")
            return False
    
    # ==========================================
    # PHOTO OPERATIONS
    # ==========================================
    
    def create_photo(self, photo_id: str, event_id: str, uploader_id: str,
                     s3_key: str, filename: str, **kwargs) -> bool:
        """Create a photo record."""
        try:
            item = {
                'PK': f'EVENT#{event_id}',
                'SK': f'PHOTO#{photo_id}',
                'GSI1PK': f'USER#{uploader_id}',
                'GSI1SK': f'PHOTO#{photo_id}',
                'photo_id': photo_id,
                'event_id': event_id,
                'uploader_id': uploader_id,
                's3_key': s3_key,
                'filename': filename,
                'is_processing': True,
                'entity_type': 'PHOTO',
                'uploaded_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            item = {k: v for k, v in item.items() if v is not None}
            
            self.table.put_item(Item=item)
            print(f"✅ Created photo: {photo_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error creating photo: {e}")
            return False
    
    def get_event_photos(self, event_id: str) -> List[Dict]:
        """Get all photos for an event."""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'EVENT#{event_id}',
                    ':sk': 'PHOTO#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting photos: {e}")
            return []
    
    def update_photo_processing(self, event_id: str, photo_id: str,
                                is_processing: bool, faces_detected: int = 0) -> bool:
        """Update photo processing status."""
        try:
            self.table.update_item(
                Key={
                    'PK': f'EVENT#{event_id}',
                    'SK': f'PHOTO#{photo_id}'
                },
                UpdateExpression='SET is_processing = :proc, faces_detected = :faces',
                ExpressionAttributeValues={
                    ':proc': is_processing,
                    ':faces': faces_detected
                }
            )
            return True
        except ClientError as e:
            print(f"❌ Error updating photo: {e}")
            return False
    
    # ==========================================
    # FACE MATCH OPERATIONS
    # ==========================================
    
    def create_face_match(self, match_id: str, photo_id: str, user_id: str,
                          event_id: str, confidence: float,
                          rekognition_face_id: str = None, **kwargs) -> bool:
        """Create a face match record."""
        try:
            # Convert confidence to Decimal for DynamoDB
            confidence_decimal = Decimal(str(confidence))
            
            item = {
                'PK': f'PHOTO#{photo_id}',
                'SK': f'MATCH#{match_id}',
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'MATCH#{match_id}',
                'match_id': match_id,
                'photo_id': photo_id,
                'user_id': user_id,
                'event_id': event_id,
                'confidence': confidence_decimal,
                'rekognition_face_id': rekognition_face_id,
                'is_confirmed': False,
                'entity_type': 'FACE_MATCH',
                'created_at': datetime.utcnow().isoformat(),
                **kwargs
            }
            
            item = {k: v for k, v in item.items() if v is not None}
            
            self.table.put_item(Item=item)
            print(f"✅ Created face match: {match_id}")
            return True
            
        except ClientError as e:
            print(f"❌ Error creating face match: {e}")
            return False
    
    def get_photo_matches(self, photo_id: str) -> List[Dict]:
        """Get all face matches for a photo."""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'PHOTO#{photo_id}',
                    ':sk': 'MATCH#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting photo matches: {e}")
            return []
    
    def get_user_photos(self, user_id: str) -> List[Dict]:
        """Get all photos where user appears (via GSI)."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'MATCH#'
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"❌ Error getting user photos: {e}")
            return []
    
    def confirm_face_match(self, photo_id: str, match_id: str) -> bool:
        """Confirm a face match (manual review)."""
        try:
            self.table.update_item(
                Key={
                    'PK': f'PHOTO#{photo_id}',
                    'SK': f'MATCH#{match_id}'
                },
                UpdateExpression='SET is_confirmed = :conf',
                ExpressionAttributeValues={':conf': True}
            )
            print(f"✅ Confirmed match: {match_id}")
            return True
        except ClientError as e:
            print(f"❌ Error confirming match: {e}")
            return False


# Singleton instance
dynamodb_service = DynamoDBService()
```

### Step 3: Test DynamoDB Operations

Create `backend/test_dynamodb.py`:

```python
"""Comprehensive DynamoDB tests."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.dynamodb import DynamoDBService
import uuid


def test_all_operations():
    """Test all CRUD operations."""
    
    print("\n" + "="*60)
    print("🗄️  DYNAMODB CRUD TESTS")
    print("="*60)
    
    db = DynamoDBService()
    
    # Generate test IDs
    user_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    photo_id = str(uuid.uuid4())
    
    # Test 1: Create User
    print("\n👤 Test 1: Create User")
    success = db.create_user(
        user_id=user_id,
        email="test@example.com",
        name="Test User",
        hashed_password="fakehash123"
    )
    assert success, "Failed to create user"
    
    # Test 2: Get User by ID
    print("\n🔍 Test 2: Get User by ID")
    user = db.get_user_by_id(user_id)
    assert user is not None, "User not found"
    assert user['name'] == "Test User"
    print(f"✅ Found user: {user['name']}")
    
    # Test 3: Get User by Email (GSI)
    print("\n📧 Test 3: Get User by Email (GSI)")
    user_by_email = db.get_user_by_email("test@example.com")
    assert user_by_email is not None, "User not found by email"
    assert user_by_email['user_id'] == user_id
    print("✅ Found user by email")
    
    # Test 4: Create Face Profile
    print("\n😊 Test 4: Create Face Profile")
    face_id = str(uuid.uuid4())
    success = db.create_face_profile(
        user_id=user_id,
        image_id=face_id,
        s3_key=f"users/{user_id}/face/{face_id}.jpg",
        rekognition_face_id="rek-face-123"
    )
    assert success, "Failed to create face profile"
    
    # Test 5: Get Face Profiles
    print("\n📸 Test 5: Get Face Profiles")
    faces = db.get_user_face_profiles(user_id)
    assert len(faces) == 1, f"Expected 1 face, got {len(faces)}"
    print(f"✅ Found {len(faces)} face profiles")
    
    # Test 6: Create Event
    print("\n📅 Test 6: Create Event")
    success = db.create_event(
        event_id=event_id,
        owner_id=user_id,
        name="Test Wedding",
        description="A beautiful wedding",
        join_code="WEDD2025"
    )
    assert success, "Failed to create event"
    
    # Test 7: Get Event
    print("\n🔍 Test 7: Get Event")
    event = db.get_event(event_id)
    assert event is not None, "Event not found"
    assert event['name'] == "Test Wedding"
    print(f"✅ Found event: {event['name']}")
    
    # Test 8: Add Participant
    print("\n👥 Test 8: Add Participant")
    success = db.add_event_participant(
        event_id=event_id,
        user_id=user_id,
        status="confirmed"
    )
    assert success, "Failed to add participant"
    
    # Test 9: Get Participants
    print("\n📋 Test 9: Get Participants")
    participants = db.get_event_participants(event_id)
    assert len(participants) == 1
    print(f"✅ Found {len(participants)} participants")
    
    # Test 10: Create Photo
    print("\n📷 Test 10: Create Photo")
    success = db.create_photo(
        photo_id=photo_id,
        event_id=event_id,
        uploader_id=user_id,
        s3_key=f"events/{event_id}/photos/{photo_id}.jpg",
        filename="wedding-photo-1.jpg"
    )
    assert success, "Failed to create photo"
    
    # Test 11: Get Event Photos
    print("\n🖼️  Test 11: Get Event Photos")
    photos = db.get_event_photos(event_id)
    assert len(photos) == 1
    print(f"✅ Found {len(photos)} photos")
    
    # Test 12: Create Face Match
    print("\n🎯 Test 12: Create Face Match")
    match_id = str(uuid.uuid4())
    success = db.create_face_match(
        match_id=match_id,
        photo_id=photo_id,
        user_id=user_id,
        event_id=event_id,
        confidence=0.95,
        rekognition_face_id="rek-match-123"
    )
    assert success, "Failed to create face match"
    
    # Test 13: Get Photo Matches
    print("\n🔎 Test 13: Get Photo Matches")
    matches = db.get_photo_matches(photo_id)
    assert len(matches) == 1
    print(f"✅ Found {len(matches)} matches in photo")
    
    # Test 14: Get User's Photos (GSI)
    print("\n🖼️  Test 14: Get User's Photos (GSI Query)")
    user_photos = db.get_user_photos(user_id)
    assert len(user_photos) == 1
    print(f"✅ User appears in {len(user_photos)} photos")
    
    # Test 15: Confirm Match
    print("\n✅ Test 15: Confirm Face Match")
    success = db.confirm_face_match(photo_id, match_id)
    assert success, "Failed to confirm match"
    
    print("\n" + "="*60)
    print("🎉 ALL DYNAMODB TESTS PASSED!")
    print("="*60)
    
    # Cleanup (optional)
    print("\n🧹 Cleaning up test data...")
    # Note: In production, you'd delete test data here
    
    return True


if __name__ == "__main__":
    try:
        success = test_all_operations()
        sys.exit(0 if success else 1)
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
```

---

## 🔧 Troubleshooting

### Error: "ResourceNotFoundException: Table not found"

**Cause**: Table doesn't exist
**Solution**:
```bash
# Check if table exists
aws dynamodb list-tables

# Create table
aws dynamodb create-table --table-name FaceShareData ...
```

### Error: "ProvisionedThroughputExceededException"

**Cause**: Too many requests (only if using provisioned mode)
**Solution**:
- Switch to on-demand: `aws dynamodb update-table --billing-mode PAY_PER_REQUEST`
- Or increase capacity: `--provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10`

### Error: "ValidationException: One or more parameter values were invalid"

**Cause**: Wrong data types
**Solution**: DynamoDB is schemaless, but keys must be strings. Use `str()` or `Decimal()` for numbers.

### Error: "ConditionalCheckFailedException"

**Cause**: Trying to overwrite existing item with condition
**Solution**: Use `ConditionExpression` to prevent overwrites, or remove condition to allow update.

---

## 💰 Cost Analysis

### Free Tier Benefits (Always Free)
- 25 GB of storage
- 200 million read requests/month
- 200 million write requests/month

### Paid Tier (Beyond Free)
| Operation | Cost per 1M requests |
|-----------|---------------------|
| **Read** | $0.25 |
| **Write** | $1.25 |
| **Storage** | $0.25/GB/month |

### Your Project Cost (100 photos/month)
| Operation | Count | Cost |
|-----------|-------|------|
| User creation | 10 | $0.00 |
| Face profiles | 30 | $0.00 |
| Events | 10 | $0.00 |
| Photos | 100 | $0.00 |
| Face matches | 200 | $0.00 |
| Queries | 500 | $0.00 |
| **TOTAL** | | **$0.00** ✅ |

---

## ✅ Week 3 Checklist

- [ ] DynamoDB table created
- [ ] GSI configured
- [ ] On-demand billing enabled
- [ ] `dynamodb.py` service created
- [ ] User CRUD operations working
- [ ] Face profile operations working
- [ ] Event operations working
- [ ] Photo operations working
- [ ] Face match operations working
- [ ] All GSI queries tested
- [ ] `test_dynamodb.py` passes

---

## 🎓 Key Takeaways

### For Your Resume
> "Designed and implemented single-table NoSQL architecture using DynamoDB, supporting 9 access patterns with sub-10ms latency. Migrated from relational PostgreSQL to serverless DynamoDB, eliminating connection limits and reducing database costs to $0."

### For LinkedIn
> "Week 3: Mastered DynamoDB! 🗄️
> 
> Learned:
> ✅ Single-table design pattern
> ✅ Partition & Sort keys
> ✅ Global Secondary Indexes
> ✅ 9 different access patterns
> ✅ NoSQL vs SQL trade-offs
> 
> Built a complete CRUD service for users, events, photos, and face matches. All queries under 10ms!
> 
> Free tier covers everything: $0 cost! 💰
> 
> #AWS #DynamoDB #NoSQL #Serverless #DatabaseDesign #LearningInPublic"

### Skills Acquired
- NoSQL data modeling
- Single-table design
- Partition key strategies
- Sort key patterns
- Global Secondary Indexes
- DynamoDB best practices
- Cost optimization

---

## 🚀 Next Week

[Week 4: AWS Rekognition Face Recognition →](week4-rekognition.md)

We'll integrate AWS AI/ML service for face detection, indexing, and matching!