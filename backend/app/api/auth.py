from fastapi import APIRouter, Depends, HTTPException, status
from uuid import uuid4
import logging
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from app.schemas.auth import Token, RefreshTokenRequest, GoogleLoginRequest
from app.schemas.user import UserResponse
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.api.deps import get_current_user
from app.core.config import settings
from app.services.dynamodb_auth_service import (
    get_user_by_email as dynamodb_get_user_by_email,
    get_user_by_id as dynamodb_get_user_by_id,
    create_user as dynamodb_create_user,
)
from app.core.dynamodb import dynamodb_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/refresh", response_model=Token)
async def refresh_token(token_data: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    payload = decode_token(token_data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = dynamodb_get_user_by_id(user_id_str)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/google", response_model=Token)
async def google_login(request: GoogleLoginRequest):
    """Sign in (or sign up) with a Google ID token."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google SSO is not configured")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            request.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication failed")

    email = idinfo["email"]
    name = idinfo.get("name", email.split("@")[0])
    avatar_url = idinfo.get("picture")

    user = dynamodb_get_user_by_email(email)
    if not user:
        user = dynamodb_create_user(email=email, name=name, password=str(uuid4()),
                                    avatar_url=avatar_url)
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user")
    elif avatar_url and user.avatar_url != avatar_url:
        dynamodb_service.update_user(user.id, avatar_url=avatar_url)

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )
