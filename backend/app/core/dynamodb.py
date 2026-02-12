"""
DynamoDB Service for FaceShare

Handles all DynamoDB operations with proper error handling and logging.
"""

import boto3
from botocore.exceptions import ClientError
from typing import Optional, List, Dict, Any
from decimal import Decimal
import json

from app.core.config import settings


class DynamoDBService:
    """
    Service class for DynamoDB operations.
    
    Provides methods for CRUD operations on FaceShare entities.
    """
    
    def __init__(self):
        """Initialize DynamoDB client and table reference."""
        self.client = boto3.client('dynamodb', region_name=settings.AWS_REGION)
        self.table_name = 'FaceShareData'
        self.resource = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.table = self.resource.Table(self.table_name)
    
    # ==========================================
    # USER OPERATIONS
    # ==========================================
    
    def create_user(self, user_id: str, email: str, name: str, **kwargs) -> bool:
        """
        Create a new user in DynamoDB.
        
        Args:
            user_id: UUID of the user
            email: User's email address
            name: User's full name
            **kwargs: Additional user attributes
        
        Returns:
            True if successful, False otherwise
        """
        try:
            item = {
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE',
                'GSI1PK': f'EMAIL#{email}',
                'GSI1SK': f'USER#{user_id}',
                'user_id': user_id,
                'email': email,
                'name': name,
                'entity_type': 'USER',
                **kwargs
            }
            
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
                KeyConditionExpression='GSI1PK = :email AND begins_with(GSI1SK, :prefix)',
                ExpressionAttributeValues={
                    ':email': f'EMAIL#{email}',
                    ':prefix': 'USER#'
                }
            )
            items = response.get('Items', [])
            return items[0] if items else None
        except ClientError as e:
            print(f"❌ Error getting user by email: {e}")
            return None
    
    # ==========================================
    # FACE PROFILE OPERATIONS
    # ==========================================
    
    def create_face_profile(self, user_id: str, image_id: str, 
                           s3_key: str, embedding: List[float], **kwargs) -> bool:
        """Create a face profile for a user."""
        try:
            # Convert embedding to DynamoDB format
            embedding_decimal = [Decimal(str(x)) for x in embedding]
            
            item = {
                'PK': f'USER#{user_id}',
                'SK': f'FACE#{image_id}',
                'user_id': user_id,
                'image_id': image_id,
                's3_key': s3_key,
                'embedding': embedding_decimal,
                'entity_type': 'FACE_PROFILE',
                **kwargs
            }
            
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
    
    # ==========================================
    # EVENT OPERATIONS
    # ==========================================
    
    def create_event(self, event_id: str, owner_id: str, name: str, 
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
                'entity_type': 'EVENT',
                **kwargs
            }
            
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
        """Get all events owned by a user."""
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
    
    # ==========================================
    # PHOTO OPERATIONS
    # ==========================================
    
    def create_photo(self, photo_id: str, event_id: str, uploader_id: str,
                     s3_key: str, **kwargs) -> bool:
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
                'is_processing': True,
                'entity_type': 'PHOTO',
                **kwargs
            }
            
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
    
    # ==========================================
    # FACE MATCH OPERATIONS
    # ==========================================
    
    def create_face_match(self, match_id: str, photo_id: str, user_id: str,
                          confidence: float, **kwargs) -> bool:
        """Create a face match record."""
        try:
            item = {
                'PK': f'PHOTO#{photo_id}',
                'SK': f'MATCH#{match_id}',
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'MATCH#{match_id}',
                'match_id': match_id,
                'photo_id': photo_id,
                'user_id': user_id,
                'confidence': Decimal(str(confidence)),
                'is_confirmed': False,
                'entity_type': 'FACE_MATCH',
                **kwargs
            }
            
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
        """Get all photos where user appears (via face matches)."""
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


# Singleton instance
dynamodb_service = DynamoDBService()
