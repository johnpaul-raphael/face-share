from sqlalchemy.orm import Session
from app.database.models import Event
import secrets
import string


def generate_unique_join_code(db: Session, length: int = 6) -> str:
    """Generate a unique event join code."""
    max_attempts = 100
    for _ in range(max_attempts):
        # Generate alphanumeric code (uppercase)
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))
        
        # Check if code already exists
        existing = db.query(Event).filter(Event.join_code == code).first()
        if not existing:
            return code
    
    raise ValueError("Failed to generate unique join code after multiple attempts")
