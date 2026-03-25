"""
FaceShare API Configuration Module

This module handles loading configuration from environment files.
Supports multiple environments: development, qa, production

Usage:
    from app.core.config import settings

    # Access configuration
    api_url = settings.API_V1_STR

Environment Files:
    - .env          : Local development (default)
    - .env.dev      : Shared development
    - .env.qa       : QA/Staging environment
    - .env.prod     : Production environment
    - .env.example  : Template (safe to commit)

Switching Environments:
    1. Set ENVIRONMENT variable:
       $env:ENVIRONMENT="qa"  # PowerShell
       export ENVIRONMENT=qa   # Linux/Mac

    2. Or specify file directly:
       $env:ENV_FILE=".env.qa"

Security:
    - NEVER commit .env files with real credentials
    - .env files are listed in .gitignore
    - Use .env.example as a template
"""

import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Any
from pydantic import model_validator
import json
import os
import pathlib

# Absolute path to backend/.env — works regardless of CWD where uvicorn is started
_BACKEND_DIR = pathlib.Path(__file__).parent.parent.parent
_DEFAULT_ENV_FILE = str(_BACKEND_DIR / ".env")

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Application settings loaded from environment files.

    Attributes are loaded from .env file (or specified env file).
    Type hints ensure proper validation.
    """

    # ==========================================
    # ENVIRONMENT SETTINGS
    # ==========================================
    ENVIRONMENT: str = "development"
    """Current environment: development, qa, or production"""

    # ==========================================
    # APPLICATION SETTINGS
    # ==========================================
    PROJECT_NAME: str = "FaceShare API"
    """API project name used in documentation"""

    VERSION: str = "1.0.0"
    """API version number"""

    API_V1_STR: str = "/api/v1"
    """Base path for API routes"""

    # ==========================================
    # SECURITY SETTINGS
    # ==========================================
    SECRET_KEY: str = "change-this-in-production"
    """
    JWT signing secret.
    Generate with: openssl rand -hex 32
    """

    ALGORITHM: str = "HS256"
    """JWT encryption algorithm"""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    """How long access tokens are valid (minutes)"""

    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    """How long refresh tokens are valid (days)"""

    # ==========================================
    # AWS SETTINGS
    # ==========================================
    AWS_DYNAMODB_TABLE_NAME: Optional[str] = None
    """DynamoDB table name for storing all application data"""
    AWS_ACCESS_KEY_ID: Optional[str] = None
    """AWS IAM access key (from AWS Console)"""

    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    """AWS IAM secret key (keep secure!)"""

    AWS_REGION: Optional[str] = None
    """AWS region for all services (S3, Rekognition, etc.)"""

    S3_BUCKET_NAME: Optional[str] = None
    """
    S3 bucket name for storing images.
    Must be globally unique across all AWS accounts.
    """

    S3_PRESIGNED_URL_EXPIRATION: int = 3600  # 1 hour
    """How long presigned URLs are valid (seconds)"""

    # ==========================================
    # REKOGNITION SETTINGS
    # ==========================================
    REKOGNITION_COLLECTION_ID: str = "faceshare-collection"
    """AWS Rekognition face collection ID"""

    REKOGNITION_FACE_MATCH_THRESHOLD: float = 80.0
    """Minimum similarity score (0-100) to consider a face match valid"""

    REKOGNITION_CONNECT_TIMEOUT: int = 5
    """Boto3 connect timeout in seconds for Rekognition calls"""

    REKOGNITION_READ_TIMEOUT: int = 30
    """Boto3 read timeout in seconds for Rekognition calls"""

    # ==========================================
    # GOOGLE SSO
    # ==========================================
    GOOGLE_CLIENT_ID: Optional[str] = None
    """Google OAuth 2.0 Client ID for verifying Google ID tokens"""

    # ==========================================
    # CORS SETTINGS
    # ==========================================
    CORS_ORIGINS: Any = "http://localhost:3000"
    """
    Allowed origins for CORS (cross-origin requests).
    Can be:
        - Single URL: "http://localhost:3000"
        - Comma-separated: "http://localhost:3000,https://app.com"
        - JSON array: '["http://localhost:3000", "https://app.com"]'
    """

    # ==========================================
    # PYDANTIC CONFIGURATION
    # ==========================================
    model_config = SettingsConfigDict(
        env_file=_DEFAULT_ENV_FILE,  # Absolute path — works from any CWD
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore',
    )

    # ==========================================
    # VALIDATORS
    # ==========================================
    @model_validator(mode='after')
    def validate_secret_key(self):
        """Reject the placeholder SECRET_KEY that ships as the default."""
        if self.SECRET_KEY in ("change-this-in-production", "", None):
            raise ValueError(
                "SECRET_KEY must be set to a strong random value. "
                "Generate one with: openssl rand -hex 32"
            )
        if len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY is too short — use at least 32 characters. "
                "Generate one with: openssl rand -hex 32"
            )
        return self

    @model_validator(mode='after')
    def parse_cors_origins(self):
        """
        Convert CORS_ORIGINS from string to list.
        Handles multiple formats: comma-separated or JSON array.
        """
        if isinstance(self.CORS_ORIGINS, str):
            v = self.CORS_ORIGINS.strip()
            # Try JSON array format first: ["url1", "url2"]
            if v.startswith('['):
                try:
                    self.CORS_ORIGINS = json.loads(v)
                    return self
                except json.JSONDecodeError:
                    pass
            # Fall back to comma-separated: url1,url2
            self.CORS_ORIGINS = [
                origin.strip()
                for origin in v.split(',')
                if origin.strip()
            ]
        elif isinstance(self.CORS_ORIGINS, list):
            # Already a list, ensure all items are strings and stripped
            self.CORS_ORIGINS = [str(origin).strip() for origin in self.CORS_ORIGINS if origin]
        return self


def get_environment_file() -> str:
    """
    Determine which .env file to load based on environment.

    Priority:
        1. ENV_FILE environment variable (explicit file path)
        2. ENVIRONMENT variable (maps to .env.{environment})
        3. Default to .env (local development)

    Returns:
        str: Path to the environment file to load
    """
    # Check if explicit file specified
    if os.getenv("ENV_FILE"):
        env_file = os.getenv("ENV_FILE")
        logger.debug("[config] Using explicit env file: %s", env_file)
        return env_file

    # Check environment name
    env = os.getenv("ENVIRONMENT", "development").lower()

    if env == "qa":
        logger.debug("[config] Loading QA environment from .env.qa")
        return str(_BACKEND_DIR / ".env.qa")
    elif env in ("production", "prod"):
        logger.debug("[config] Loading Production environment from .env.prod")
        return str(_BACKEND_DIR / ".env.prod")
    elif env in ("development", "dev"):
        logger.debug("[config] Loading Development environment from .env")
        return str(_BACKEND_DIR / ".env")
    else:
        logger.warning("[config] Unknown environment '%s', using default .env", env)
        return str(_BACKEND_DIR / ".env")


# ==========================================
# LOAD SETTINGS
# ==========================================

# Determine which environment file to use
_env_file = get_environment_file()

# Create settings instance with selected environment
settings = Settings(_env_file=_env_file)

# Log configuration summary at DEBUG level (not visible in production by default)
logger.debug(
    "[CONFIG] FaceShare API | env=%s | bucket=%s | region=%s | table=%s",
    settings.ENVIRONMENT,
    settings.S3_BUCKET_NAME,
    settings.AWS_REGION,
    settings.AWS_DYNAMODB_TABLE_NAME,
)
