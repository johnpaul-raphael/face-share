# FaceShare Backend

FastAPI backend for FaceShare. Runs locally for development and deploys to AWS Lambda via Mangum.

## Stack

- **FastAPI** — REST API framework
- **AWS DynamoDB** — sole database (single-table design)
- **AWS S3** — image storage with presigned URLs
- **AWS Rekognition** — face indexing and matching
- **Mangum** — ASGI adapter for Lambda
- **JWT** — access + refresh token auth

## Setup

### 1. Install dependencies

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Key variables:

| Variable | Notes |
|----------|-------|
| `SECRET_KEY` | `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | e.g. `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket for images |
| `REKOGNITION_COLLECTION_ID` | Rekognition face collection |
| `CORS_ORIGINS` | JSON array of allowed origins |

### 3. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── app/
│   ├── main.py                        # FastAPI app + router registration
│   ├── core/
│   │   ├── config.py                  # Settings via pydantic-settings
│   │   ├── dynamodb.py                # DynamoDBService — all CRUD
│   │   ├── rekognition.py             # Rekognition client
│   │   ├── s3.py                      # Presigned URL helpers
│   │   └── security.py                # JWT + bcrypt
│   ├── api/
│   │   ├── deps.py                    # get_current_user dependency
│   │   ├── auth.py                    # /auth routes
│   │   ├── users.py                   # /users routes
│   │   ├── events.py                  # /events routes
│   │   ├── participants.py            # /events/{id}/participants routes
│   │   └── images.py                  # /images + photo pipeline routes
│   ├── schemas/                        # Pydantic request/response models
│   └── services/
│       └── dynamodb_auth_service.py   # Auth helpers wrapping DynamoDB
└── lambda_handler.py                  # Mangum wrapper for Lambda
```

## Running Tests

```bash
pytest
pytest test_dynamodb.py -v   # single file
```

## Notes

- All endpoints except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`
- S3 presigned URLs are generated using the default boto3 credential chain (important for Lambda STS credentials)
- Event join codes are 6 characters (uppercase alphanumeric)
- All joins are auto-approved — no pending approval step
