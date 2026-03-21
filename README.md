# FaceShare

> **Smart event photo sharing powered by face recognition.**
> Upload event photos once — FaceShare automatically finds and delivers every photo to the people who appear in them.

---

## What is FaceShare?

FaceShare solves the classic event photography problem: hundreds of photos scattered across attendees' phones, and no easy way to find the ones you're actually in.

**How it works:**
1. Register your face profile (2–5 clear photos of yourself)
2. Join an event using a 6-character invite code
3. Anyone at the event uploads photos to the shared album
4. AWS Rekognition scans every photo and automatically matches faces
5. You see only the photos you appear in — no manual searching

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TailwindCSS, shadcn/ui |
| Backend | FastAPI (Python), AWS Lambda (via Mangum) |
| Database | AWS DynamoDB (single-table design) |
| Storage | AWS S3 (presigned URLs for direct upload) |
| Face AI | AWS Rekognition |
| Deployment | AWS Lambda + API Gateway (Serverless Framework) |

---

## Features

- **Face profile registration** — Upload 2–5 selfies; Rekognition indexes your face
- **Event management** — Create events, generate join codes, manage participants
- **Smart photo delivery** — Every uploaded photo is scanned; matched users are notified
- **Presigned S3 uploads** — Photos go directly from the browser to S3 (no server relay)
- **JWT authentication** — Access + refresh token flow
- **Serverless backend** — Runs on AWS Lambda with zero server management

---

## Project Structure

```
face-share/
├── src/                          # Next.js 15 frontend
│   ├── app/                      # App Router pages
│   │   ├── dashboard/            # Main app (events, photos, profile)
│   │   └── login/                # Auth pages
│   ├── components/               # React components (shadcn/ui)
│   ├── lib/
│   │   ├── api.ts                # ApiClient — all backend HTTP calls
│   │   └── types.ts              # Shared TypeScript types
│   └── ai/flows/                 # Google Genkit AI flows (Gemini)
│
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── api/                  # Route handlers
│   │   ├── core/
│   │   │   ├── dynamodb.py       # All DynamoDB operations
│   │   │   ├── rekognition.py    # AWS Rekognition client
│   │   │   ├── s3.py             # S3 presigned URLs
│   │   │   ├── security.py       # JWT + bcrypt
│   │   │   └── config.py         # Environment config
│   │   └── services/             # Business logic
│   └── lambda_handler.py         # Mangum wrapper for Lambda
│
└── infrastructure/
    └── serverless.yml            # Serverless Framework config
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- AWS account with DynamoDB, S3, and Rekognition access

### Frontend

```bash
# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local

# Start dev server (port 9002)
npm run dev
```

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# or: venv\Scripts\activate.bat  # Windows CMD
# or: .\venv\Scripts\Activate.ps1 # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your AWS credentials and secrets

# Start the API server (port 8000)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`

### Backend Environment Variables (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key — generate with `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | e.g. `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket for all image storage |
| `REKOGNITION_COLLECTION_ID` | Rekognition face collection ID |
| `CORS_ORIGINS` | JSON array: `["http://localhost:9002"]` |

---

## API Reference

All routes prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, get tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user info |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/users/me` | View/update profile |
| GET | `/users/me/face-profile` | List face profile images |
| DELETE | `/users/me/face-profile/{image_id}` | Remove a face photo |

### Events
| Method | Path | Description |
|--------|------|-------------|
| POST | `/events` | Create event |
| GET | `/events` | My events |
| GET/PATCH/DELETE | `/events/{id}` | Event CRUD (owner) |
| POST | `/events/join` | Join with a code |
| GET | `/events/{id}/participants` | List participants |
| DELETE | `/events/{id}/participants/{user_id}` | Remove participant |

### Images
| Method | Path | Description |
|--------|------|-------------|
| POST | `/images/presigned-upload` | Get S3 upload URL |
| POST | `/images/presigned-download` | Get S3 download URL |
| POST | `/images/face-profile/confirm-upload` | Register face after upload |

---

## Database Design

Single DynamoDB table (`FaceShareData`) with composite keys:

| Entity | PK | SK |
|--------|----|----|
| User | `USER#{id}` | `PROFILE` |
| Face profile | `USER#{id}` | `FACE#{image_id}` |
| Event | `EVENT#{id}` | `METADATA` |
| Participant | `EVENT#{id}` | `USER#{user_id}` |
| Photo | `EVENT#{id}` | `PHOTO#{id}` |
| Face match | `PHOTO#{id}` | `MATCH#{id}` |
| Join code lookup | `JOINCODE#{code}` | `LOOKUP` |

---

## Photo Pipeline

```
Browser → S3 (presigned upload)
             ↓
         S3 trigger → Lambda
                          ↓
                     Rekognition SearchFacesByImage
                          ↓
                     Match records in DynamoDB
                          ↓
                     Users see their photos
```

---

## Deployment

The backend deploys to AWS Lambda via [Serverless Framework](https://www.serverless.com/).

```bash
# Deploy backend
cd infrastructure
serverless deploy

# Or update Lambda code only (faster)
aws lambda update-function-code \
  --function-name face-share \
  --zip-file fileb://function.zip
```

Update the frontend to point to the deployed API:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://<your-api-gateway-id>.execute-api.<region>.amazonaws.com/api/v1
```

---

## Running Tests

```bash
# Backend
cd backend
pytest

# Frontend type check
npx tsc --noEmit

# Frontend lint
npx next lint --dir src
```

---

## License

MIT
