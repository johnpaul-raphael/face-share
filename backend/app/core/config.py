from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Any
from pydantic import model_validator
import json


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "FaceShare API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/faceshare"
    
    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "faceshare-uploads"
    S3_PRESIGNED_URL_EXPIRATION: int = 3600  # 1 hour
    
    # CORS - stored as string in env, converted to list
    CORS_ORIGINS: Any = "http://localhost:9002"
    
    @model_validator(mode='after')
    def parse_cors_origins(self):
        """Convert CORS_ORIGINS string to list after model is created."""
        if isinstance(self.CORS_ORIGINS, str):
            v = self.CORS_ORIGINS.strip()
            # Try to parse as JSON first
            if v.startswith('['):
                try:
                    self.CORS_ORIGINS = json.loads(v)
                    return self
                except json.JSONDecodeError:
                    pass
            # Otherwise split by comma
            self.CORS_ORIGINS = [origin.strip() for origin in v.split(',') if origin.strip()]
        return self
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()
