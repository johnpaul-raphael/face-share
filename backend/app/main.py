from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api import auth, users, events, participants, images, deepface
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)


def _cors_headers_for_request(request: Request) -> dict:
    """Build CORS headers so error responses (e.g. 500) are not blocked by the browser."""
    origin = request.headers.get("origin")
    if origin and origin in settings.CORS_ORIGINS:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}
    if settings.CORS_ORIGINS:
        return {"Access-Control-Allow-Origin": settings.CORS_ORIGINS[0], "Access-Control-Allow-Credentials": "true"}
    return {}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure 500 responses include CORS headers so the frontend sees the real error."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers_for_request(request),
    )


# Log CORS origins for debugging
logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")

# CORS middleware - must be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(events.router, prefix=f"{settings.API_V1_STR}/events", tags=["events"])
app.include_router(participants.router, prefix=f"{settings.API_V1_STR}", tags=["participants"])
app.include_router(images.router, prefix=f"{settings.API_V1_STR}/images", tags=["images"])
app.include_router(deepface.router, prefix=f"{settings.API_V1_STR}/deepface", tags=["deepface"])


@app.get("/")
async def root():
    return {
        "message": "FaceShare API",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/cors-test")
async def cors_test():
    """Test endpoint to verify CORS is working"""
    return {
        "message": "CORS is working!",
        "allowed_origins": settings.CORS_ORIGINS
    }
