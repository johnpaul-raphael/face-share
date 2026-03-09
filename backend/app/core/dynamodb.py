"""
DynamoDB Service for FaceShare

Handles all DynamoDB operations with proper error handling and logging.
"""

import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


class DynamoDBService:
    """
    Service class for DynamoDB operations.

    Provides methods for CRUD operations on FaceShare entities.
    """

    def __init__(self):
        """Initialize DynamoDB client and table reference."""
        self.client = boto3.client('dynamodb', region_name=settings.AWS_REGION)
        self.table_name = settings.AWS_DYNAMODB_TABLE_NAME
        self.resource = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.table = self.resource.Table(self.table_name)

    # ==========================================
    # USER OPERATIONS
    # ==========================================

    def create_user(self, user_id: str, email: str, name: str,
                    hashed_password: str = None, **kwargs) -> bool:
        """
        Create a new user in DynamoDB.

        Args:
            user_id: UUID of the user
            email: User's email address
            name: User's full name
            hashed_password: Bcrypt hashed password
            **kwargs: Additional user attributes

        Returns:
            True if successful, False otherwise
        """
        try:
            now = datetime.now(timezone.utc).isoformat()

            item = {
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE',
                'GSI1PK': f'EMAIL#{email}',
                'GSI1SK': f'USER#{user_id}',
                'user_id': user_id,
                'email': email,
                'name': name,
                'hashed_password': hashed_password,
                'entity_type': 'USER',
                'created_at': now,
                'updated_at': now,
                **kwargs
            }

            # Remove None values (but keep empty strings and False)
            item = {k: v for k, v in item.items() if v is not None}

            self.table.put_item(Item=item)
            logger.info("[db] Created user: %s", user_id)
            return True

        except ClientError as e:
            logger.error("[db] Error creating user: %s", e)
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
            logger.error("[db] Error getting user: %s", e)
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
            logger.error("[db] Error getting user by email: %s", e)
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
            logger.info("[db] Created face profile: %s", image_id)
            return True

        except ClientError as e:
            logger.error("[db] Error creating face profile: %s", e)
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
            logger.error("[db] Error getting face profiles: %s", e)
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
            logger.info("[db] Created event: %s", event_id)
            return True

        except ClientError as e:
            logger.error("[db] Error creating event: %s", e)
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
            logger.error("[db] Error getting event: %s", e)
            return None

    def get_user_events(self, user_id: str) -> List[Dict]:
        """Get all events owned by a user."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                FilterExpression='entity_type = :type',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'EVENT#',
                    ':type': 'EVENT',
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error("[db] Error getting user events: %s", e)
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
            logger.info("[db] Added participant %s to event %s", user_id, event_id)
            return True

        except ClientError as e:
            logger.error("[db] Error adding participant: %s", e)
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
            logger.error("[db] Error getting participants: %s", e)
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
            logger.info("[db] Created photo: %s", photo_id)
            return True

        except ClientError as e:
            logger.error("[db] Error creating photo: %s", e)
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
            logger.error("[db] Error getting photos: %s", e)
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
            logger.info("[db] Created face match: %s", match_id)
            return True

        except ClientError as e:
            logger.error("[db] Error creating face match: %s", e)
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
            logger.error("[db] Error getting photo matches: %s", e)
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
            logger.error("[db] Error getting user photos: %s", e)
            return []


    # ==========================================
    # INTERNAL HELPERS
    # ==========================================

    def _build_update_expression(self, updates: dict) -> tuple:
        """Build DynamoDB UpdateExpression from a dict of updates.

        Returns (UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues).
        All keys are aliased with #k to avoid reserved-word conflicts.
        """
        set_parts = []
        names = {}
        values = {}
        now = datetime.now(timezone.utc).isoformat()
        updates['updated_at'] = now
        for i, (key, value) in enumerate(updates.items()):
            alias = f"#k{i}"
            val_alias = f":v{i}"
            names[alias] = key
            values[val_alias] = value
            set_parts.append(f"{alias} = {val_alias}")
        expression = "SET " + ", ".join(set_parts)
        return expression, names, values

    # ==========================================
    # USER UPDATE
    # ==========================================

    def update_user(self, user_id: str, **updates) -> bool:
        """Update user attributes."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating user: %s", e)
            return False

    # ==========================================
    # FACE PROFILE CRUD
    # ==========================================

    def get_face_profile_image(self, user_id: str, image_id: str) -> Optional[Dict]:
        """Get a single face profile image record."""
        try:
            response = self.table.get_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'FACE#{image_id}'}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error("[db] Error getting face profile image: %s", e)
            return None

    def update_face_profile(self, user_id: str, image_id: str, **updates) -> bool:
        """Update a face profile image record."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'FACE#{image_id}'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating face profile: %s", e)
            return False

    def delete_face_profile(self, user_id: str, image_id: str) -> bool:
        """Delete a face profile image record."""
        try:
            self.table.delete_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'FACE#{image_id}'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting face profile: %s", e)
            return False

    # ==========================================
    # EVENT UPDATE / DELETE / JOIN CODE
    # ==========================================

    def update_event(self, event_id: str, **updates) -> bool:
        """Update event metadata."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': 'METADATA'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating event: %s", e)
            return False

    def delete_event(self, event_id: str) -> bool:
        """Delete an event metadata record."""
        try:
            self.table.delete_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': 'METADATA'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting event: %s", e)
            return False

    def create_join_code_lookup(self, join_code: str, event_id: str) -> bool:
        """Store a join-code -> event_id lookup record."""
        try:
            self.table.put_item(Item={
                'PK': f'JOINCODE#{join_code}',
                'SK': 'LOOKUP',
                'event_id': event_id,
                'entity_type': 'JOIN_CODE',
            })
            return True
        except ClientError as e:
            logger.error("[db] Error creating join code lookup: %s", e)
            return False

    def delete_join_code_lookup(self, join_code: str) -> bool:
        """Delete a join-code lookup record."""
        try:
            self.table.delete_item(
                Key={'PK': f'JOINCODE#{join_code}', 'SK': 'LOOKUP'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting join code lookup: %s", e)
            return False

    def get_event_by_join_code(self, join_code: str) -> Optional[Dict]:
        """Look up an event by its join code. Returns the full event item or None."""
        try:
            response = self.table.get_item(
                Key={'PK': f'JOINCODE#{join_code}', 'SK': 'LOOKUP'}
            )
            item = response.get('Item')
            if not item:
                return None
            return self.get_event(item['event_id'])
        except ClientError as e:
            logger.error("[db] Error looking up join code: %s", e)
            return None

    def get_events_user_joined(self, user_id: str) -> List[Dict]:
        """Get all events where user is a participant (not owner). Uses GSI1."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                FilterExpression='entity_type = :type',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'EVENT#',
                    ':type': 'PARTICIPANT',
                }
            )
            participant_items = response.get('Items', [])
            events = []
            for item in participant_items:
                event = self.get_event(item['event_id'])
                if event:
                    events.append(event)
            return events
        except ClientError as e:
            logger.error("[db] Error getting joined events: %s", e)
            return []

    # ==========================================
    # PARTICIPANT CRUD
    # ==========================================

    def get_participant(self, event_id: str, user_id: str) -> Optional[Dict]:
        """Get a single participant record."""
        try:
            response = self.table.get_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'USER#{user_id}'}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error("[db] Error getting participant: %s", e)
            return None

    def update_participant(self, event_id: str, user_id: str, **updates) -> bool:
        """Update arbitrary participant attributes."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'USER#{user_id}'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating participant: %s", e)
            return False

    def update_participant_status(self, event_id: str, user_id: str, status: str) -> bool:
        """Update participant status."""
        try:
            now = datetime.now(timezone.utc).isoformat()
            self.table.update_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'USER#{user_id}'},
                UpdateExpression='SET #s = :s, updated_at = :u',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':s': status, ':u': now},
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating participant status: %s", e)
            return False

    def delete_participant(self, event_id: str, user_id: str) -> bool:
        """Remove a participant from an event."""
        try:
            self.table.delete_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'USER#{user_id}'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting participant: %s", e)
            return False

    # ==========================================
    # PHOTO CRUD
    # ==========================================

    def get_photo(self, event_id: str, photo_id: str) -> Optional[Dict]:
        """Get a photo record."""
        try:
            response = self.table.get_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'PHOTO#{photo_id}'}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error("[db] Error getting photo: %s", e)
            return None

    def update_photo(self, event_id: str, photo_id: str, **updates) -> bool:
        """Update a photo record."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'PHOTO#{photo_id}'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating photo: %s", e)
            return False

    def delete_photo(self, event_id: str, photo_id: str) -> bool:
        """Delete a photo record."""
        try:
            self.table.delete_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'PHOTO#{photo_id}'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting photo: %s", e)
            return False

    # ==========================================
    # MATCH CRUD
    # ==========================================

    def get_match(self, photo_id: str, match_id: str) -> Optional[Dict]:
        """Get a face match record."""
        try:
            response = self.table.get_item(
                Key={'PK': f'PHOTO#{photo_id}', 'SK': f'MATCH#{match_id}'}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error("[db] Error getting match: %s", e)
            return None

    def update_match(self, photo_id: str, match_id: str, **updates) -> bool:
        """Update a face match record."""
        try:
            expr, names, values = self._build_update_expression(updates)
            self.table.update_item(
                Key={'PK': f'PHOTO#{photo_id}', 'SK': f'MATCH#{match_id}'},
                UpdateExpression=expr,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
            return True
        except ClientError as e:
            logger.error("[db] Error updating match: %s", e)
            return False

    def delete_match(self, photo_id: str, match_id: str) -> bool:
        """Delete a face match record."""
        try:
            self.table.delete_item(
                Key={'PK': f'PHOTO#{photo_id}', 'SK': f'MATCH#{match_id}'}
            )
            return True
        except ClientError as e:
            logger.error("[db] Error deleting match: %s", e)
            return False

    def get_user_photos_with_details(self, user_id: str) -> List[Dict]:
        """Get all face match records for a user via GSI1."""
        try:
            response = self.table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'MATCH#',
                }
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error("[db] Error getting user photo matches: %s", e)
            return []

    def get_photo_match_count(self, photo_id: str) -> int:
        """Count matches for a photo."""
        try:
            response = self.table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                Select='COUNT',
                ExpressionAttributeValues={
                    ':pk': f'PHOTO#{photo_id}',
                    ':sk': 'MATCH#',
                }
            )
            return response.get('Count', 0)
        except ClientError as e:
            logger.error("[db] Error counting photo matches: %s", e)
            return 0


# Singleton instance
dynamodb_service = DynamoDBService()
