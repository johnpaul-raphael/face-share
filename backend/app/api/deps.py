from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import get_user_id_from_token
from app.services.dynamodb_auth_service import get_user_by_id
from typing import Optional

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get the current authenticated user using DynamoDB."""
    token = credentials.credentials
    user_id_str = get_user_id_from_token(token)

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from DynamoDB
    user = get_user_by_id(user_id_str)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """Get the current user if authenticated, otherwise None."""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
