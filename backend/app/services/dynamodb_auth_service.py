"""
DynamoDB Authentication Service for FaceShare
"""

from typing import Optional, Dict
from uuid import uuid4
from app.core.dynamodb import dynamodb_service
from app.core.security import get_password_hash


class DynamoDBUser:
    """User model wrapper for DynamoDB user items."""

    def __init__(self, item: Dict):
        self._item = item
        self.id = item.get('user_id')
        self.email = item.get('email')
        self.name = item.get('name')
        self.avatar_url = item.get('avatar_url')
        self.created_at = item.get('created_at')
        self.updated_at = item.get('updated_at')

    def __repr__(self):
        return f"<DynamoDBUser {self.email}>"


def get_user_by_email(email: str) -> Optional[DynamoDBUser]:
    user_item = dynamodb_service.get_user_by_email(email)
    if not user_item:
        return None
    return DynamoDBUser(user_item)


def get_user_by_id(user_id: str) -> Optional[DynamoDBUser]:
    user_item = dynamodb_service.get_user_by_id(user_id)
    if not user_item:
        return None
    return DynamoDBUser(user_item)


def create_user(email: str, name: str, password: str, **kwargs) -> Optional[DynamoDBUser]:
    """Create a new user in DynamoDB. Password is hashed before storing."""
    existing = get_user_by_email(email)
    if existing:
        return None

    user_id = str(uuid4())
    hashed_password = get_password_hash(password)

    success = dynamodb_service.create_user(
        user_id=user_id,
        email=email,
        name=name,
        hashed_password=hashed_password,
        **kwargs
    )

    if not success:
        return None

    return get_user_by_id(user_id)
