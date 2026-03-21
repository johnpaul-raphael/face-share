"""
Public configuration endpoint.
Returns app-level settings that the frontend needs at runtime.
No authentication required — values here are non-sensitive feature flags.
"""
from fastapi import APIRouter
from app.core.ssm import get_parameter

router = APIRouter()

SSM_IMAGE_QUALITY = "/faceshare/image_quality"


@router.get("/config")
async def get_app_config():
    """
    Returns runtime configuration controlled via AWS SSM Parameter Store.
    Changes to SSM parameters take effect within 5 minutes — no redeploy needed.

    SSM parameters:
      /faceshare/image_quality  →  "optimized" | "original"
    """
    image_quality = get_parameter(SSM_IMAGE_QUALITY, default="optimized")
    # Sanitise: reject unexpected values so frontend always gets a known state
    if image_quality not in ("optimized", "original"):
        image_quality = "optimized"

    return {"image_quality": image_quality}
