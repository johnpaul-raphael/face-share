"""
AWS Lambda handler for the FaceShare FastAPI application.
Wraps the FastAPI app with Mangum for API Gateway compatibility.
"""
from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="off")
