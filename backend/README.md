# FaceShare Backend API

FastAPI backend for the FaceShare application with JWT authentication, PostgreSQL, SQLAlchemy, and AWS S3 presigned uploads.

## Features

- JWT-based authentication with access and refresh tokens
- PostgreSQL database with SQLAlchemy ORM
- AWS S3 presigned URLs for secure file uploads
- User management and face profile management
- Event management with join codes
- Photo upload and face matching support
- Manual review system for low-confidence matches

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

Key variables to configure:
- `SECRET_KEY`: Generate a secure secret key (use `openssl rand -hex 32`)
- `DATABASE_URL`: PostgreSQL connection string
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `S3_BUCKET_NAME`: Your S3 bucket name

### 3. Database Setup

Create the database:

```bash
createdb faceshare
```

Run migrations:

```bash
alembic upgrade head
```

Or create initial migration:

```bash
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 4. Run the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/api/v1/docs`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user info

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update user profile
- `GET /api/v1/users/me/face-profile` - Get face profile images
- `DELETE /api/v1/users/me/face-profile/{image_id}` - Delete face profile image

### Events
- `POST /api/v1/events` - Create a new event
- `GET /api/v1/events` - List user's events
- `GET /api/v1/events/{event_id}` - Get event details
- `PATCH /api/v1/events/{event_id}` - Update event (owner only)
- `DELETE /api/v1/events/{event_id}` - Delete event (owner only)
- `POST /api/v1/events/join` - Join an event with join code

### Participants
- `GET /api/v1/events/{event_id}/participants` - List event participants
- `PATCH /api/v1/events/{event_id}/participants/{user_id}/approve` - Approve participant
- `DELETE /api/v1/events/{event_id}/participants/{user_id}` - Remove participant

### Images
- `POST /api/v1/images/presigned-upload` - Get presigned upload URL
- `POST /api/v1/images/presigned-download` - Get presigned download URL
- `POST /api/v1/images/face-profile/confirm-upload` - Confirm face profile upload

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── core/
│   │   ├── config.py       # Configuration settings
│   │   ├── security.py     # JWT and password hashing
│   │   └── s3.py           # S3 presigned URL generation
│   ├── database/
│   │   ├── base.py         # SQLAlchemy base
│   │   ├── session.py      # Database session
│   │   └── models.py       # Database models
│   ├── api/
│   │   ├── deps.py         # Dependencies (auth, db)
│   │   ├── auth.py         # Authentication routes
│   │   ├── users.py        # User routes
│   │   ├── events.py       # Event routes
│   │   ├── participants.py # Participant routes
│   │   └── images.py       # Image upload routes
│   ├── schemas/
│   │   ├── auth.py         # Auth schemas
│   │   ├── user.py         # User schemas
│   │   ├── event.py        # Event schemas
│   │   └── image.py        # Image schemas
│   └── services/
│       ├── auth_service.py      # Authentication logic
│       ├── event_service.py     # Event business logic
│       └── moderation_service.py # Moderation/review logic
├── alembic/                # Database migrations
└── requirements.txt        # Python dependencies
```

## Development

### Running Tests

```bash
pytest
```

### Database Migrations

Create a new migration:

```bash
alembic revision --autogenerate -m "Description of changes"
```

Apply migrations:

```bash
alembic upgrade head
```

Rollback:

```bash
alembic downgrade -1
```

## Notes

- All endpoints except `/auth/register` and `/auth/login` require authentication
- JWT tokens should be included in the `Authorization` header as `Bearer <token>`
- S3 presigned URLs expire after 1 hour by default (configurable)
- Face profile images are limited to 3-5 images per user
- Event join codes are 6 characters (alphanumeric, uppercase)
