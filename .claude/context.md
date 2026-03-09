# FaceShare Project Context

This document provides comprehensive context about the FaceShare project for AI assistants and developers.

## Project Vision

**FaceShare** is a photo-sharing application that uses face recognition to automatically deliver event photos to attendees. Instead of manually tagging people or scrolling through hundreds of photos, users receive only the photos where they appear.

### Core Value Proposition
- **For Event Attendees**: Automatically receive your photos without searching
- **For Event Organizers**: Easy photo distribution without manual tagging
- **For Photographers**: Efficient delivery to multiple people at scale

### Key Differentiators
- Face recognition powered by DeepFace/AWS Rekognition
- Privacy-focused: Users control their face profile
- Event-based: Photos are organized by events, not general albums
- Approval workflow: Event organizers can moderate who joins

## Technical Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Build Tool**: Turbopack (Next.js built-in)
- **AI**: Google Genkit with Gemini 2.5 Flash
- **State**: React hooks (useState, useEffect)
- **HTTP Client**: Custom ApiClient class (fetch wrapper)
- **Dev Server**: Port 9002

#### Backend
- **Framework**: FastAPI (Python 3.12+)
- **Database**: AWS DynamoDB (single table design)
- **Storage**: AWS S3 (images)
- **Face Recognition**:
  - Primary: DeepFace with SFace model
  - Alternative: AWS Rekognition
- **Authentication**: JWT tokens (access + refresh)
- **Password Hashing**: bcrypt via passlib
- **Dev Server**: uvicorn (port 8000)

#### Infrastructure
- **Cloud**: AWS
- **Deployment**: Serverless Framework (Lambda)
- **Region**: ap-southeast-1 (configurable)
- **Environment Management**: python-dotenv, pydantic-settings

### System Components

#### 1. Authentication Flow
```
User → Frontend → POST /api/v1/auth/login → Backend
                                              ↓
                                         DynamoDB (verify credentials)
                                              ↓
                                         Return JWT tokens
                                              ↓
Frontend stores tokens in localStorage
```

- Access token: 7 days expiry
- Refresh token: 30 days expiry
- Tokens stored client-side in localStorage
- Protected routes use `get_current_user` dependency

#### 2. Face Profile Registration
```
User uploads photo → Frontend requests presigned URL → Backend generates S3 URL
                                                          ↓
Frontend uploads directly to S3
                                                          ↓
Frontend confirms upload → Backend processes face
                                    ↓
                            DeepFace extracts embedding
                                    ↓
                            Store in DynamoDB + dataset folder
```

- Each user can have multiple face profile images
- Images stored in `dataset/{user_id}/` folder
- Embeddings cached for fast matching

#### 3. Event Creation & Joining
```
Owner creates event → Stored in DynamoDB (EVENT#{id})
                            ↓
Generates share link with access code
                            ↓
Users join via link → Creates participant record (pending)
                            ↓
Owner approves → Participant status = active
```

- Events have privacy levels (public/private)
- Join codes prevent unauthorized access
- Participant approval workflow for moderation

#### 4. Photo Upload & Face Matching
```
User uploads event photo → S3 (event_uploads folder)
                                ↓
                        Backend triggers face detection
                                ↓
                        DeepFace finds faces in photo
                                ↓
                        Compare against registered faces
                                ↓
                        Create match records in DynamoDB
                                ↓
                        Users can view "their" photos
```

- Two matching pipelines:
  - **Fast**: SFace with cached embeddings (default)
  - **Slow**: VGG-Face with DeepFace.find()
- Similarity threshold: 0.55 cosine distance
- Batch processing for multiple photos

### Data Model (DynamoDB Single Table)

#### Table: `FaceShareData`

**Primary Key**: `PK` (partition key), `SK` (sort key)
**GSI1**: `GSI1PK` (partition), `GSI1SK` (sort)

#### Entity Patterns

| Entity | PK | SK | GSI1PK | GSI1SK | Use Case |
|--------|----|----|--------|--------|----------|
| User Profile | `USER#{user_id}` | `PROFILE` | `EMAIL#{email}` | `USER#{user_id}` | Get user by ID or email |
| Face Profile | `USER#{user_id}` | `FACE#{image_id}` | - | - | Get user's face images |
| Event Metadata | `EVENT#{event_id}` | `METADATA` | `USER#{owner_id}` | `EVENT#{event_id}` | Get event or user's events |
| Participant | `EVENT#{event_id}` | `USER#{user_id}` | `USER#{user_id}` | `EVENT#{event_id}` | Get event participants or user's events |
| Photo | `EVENT#{event_id}` | `PHOTO#{photo_id}` | `USER#{uploader_id}` | `PHOTO#{photo_id}` | Get event photos or user's uploads |
| Face Match | `PHOTO#{photo_id}` | `MATCH#{match_id}` | `USER#{user_id}` | `MATCH#{match_id}` | Get faces in photo or user's photos |

#### Access Patterns
1. Get user by email: Query GSI1 with `GSI1PK = EMAIL#{email}`
2. Get user's events: Query GSI1 with `GSI1PK = USER#{user_id}`, `SK begins_with EVENT#`
3. Get event participants: Query with `PK = EVENT#{id}`, `SK begins_with USER#`
4. Get photos where user appears: Query GSI1 with `GSI1PK = USER#{user_id}`, `SK begins_with MATCH#`
5. Get all photos in event: Query with `PK = EVENT#{id}`, `SK begins_with PHOTO#`

### File Structure

```
face-share/
├── .claude/                    # Claude Code configuration
│   ├── CLAUDE.md              # Main project documentation
│   ├── rules.md               # This file - coding standards
│   ├── context.md             # Project context
│   └── prompts.md             # Reusable prompts
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   │   ├── auth.py        # Login, register, refresh
│   │   │   ├── users.py       # User profile management
│   │   │   ├── events.py      # Event CRUD
│   │   │   ├── participants.py # Participant management
│   │   │   ├── images.py      # S3 presigned URLs
│   │   │   ├── deepface.py    # Face recognition
│   │   │   └── deps.py        # Shared dependencies
│   │   ├── core/              # Core services
│   │   │   ├── config.py      # Settings management
│   │   │   ├── security.py    # JWT, password hashing
│   │   │   └── dynamodb.py    # DynamoDB service
│   │   ├── schemas/           # Pydantic models
│   │   │   ├── user.py        # User DTOs
│   │   │   ├── event.py       # Event DTOs
│   │   │   └── image.py       # Image DTOs
│   │   ├── services/          # Business logic
│   │   │   └── dynamodb_auth_service.py
│   │   └── main.py            # FastAPI app entry
│   ├── tests/                 # Test files
│   ├── dataset/               # Face profile images (local)
│   ├── event_uploads/         # Event photos (local)
│   ├── requirements.txt       # Python dependencies
│   ├── lambda_handler.py      # AWS Lambda entry
│   └── .env                   # Environment config (gitignored)
├── src/                       # Next.js frontend
│   ├── app/                   # App Router pages
│   │   ├── (auth)/           # Auth route group
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/        # Protected routes
│   │   │   ├── events/
│   │   │   │   ├── [id]/    # Dynamic event pages
│   │   │   │   │   ├── page.tsx        # Event details
│   │   │   │   │   ├── participants/   # Manage participants
│   │   │   │   │   └── review/         # Review photos
│   │   │   │   └── join/    # Join event via link
│   │   │   ├── my-photos/   # User's photos
│   │   │   ├── profile/     # User profile
│   │   │   ├── layout.tsx   # Dashboard layout
│   │   │   └── page.tsx     # Dashboard home
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── create-event-dialog.tsx
│   │   ├── user-nav.tsx
│   │   └── logo.tsx
│   ├── lib/                  # Utilities
│   │   ├── api.ts           # ApiClient class
│   │   ├── types.ts         # TypeScript types
│   │   ├── data.ts          # Mock data (temporary)
│   │   └── utils.ts         # Helper functions
│   ├── hooks/               # Custom hooks
│   └── ai/                  # Genkit flows
│       └── flows/
├── infrastructure/           # Deployment config
│   └── serverless.yml       # Serverless Framework
├── docs/                    # Documentation
│   └── local-setup.md
├── package.json             # Frontend dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.ts       # Tailwind config
├── next.config.ts           # Next.js config
└── .env.local              # Frontend env vars (gitignored)
```

## Current Implementation Status

### ✅ Completed Features
- User registration and authentication (JWT)
- Face profile upload and storage
- Event creation and management
- Event join via access code
- Participant approval workflow
- Photo upload to events
- Face matching (DeepFace SFace)
- S3 presigned URL generation
- DynamoDB data layer (migrated from PostgreSQL)
- Basic frontend UI (landing, login, signup, dashboard)

### 🚧 Partially Complete
- Frontend pages still using mock data from `lib/data.ts`
- Face matching UI (review page exists but not fully wired)
- Batch photo scanning (endpoint exists but needs optimization)
- User profile management (basic implementation)

### 📋 Planned Features
- Photo download/sharing
- Event photo gallery
- Face profile management (delete, add multiple)
- Email notifications
- Search and filtering
- Analytics dashboard
- Mobile app (future)

## Known Issues & Technical Debt

### Critical
- Hardcoded file paths in `backend/app/api/deepface.py` (Windows absolute paths)
- Mock data still in use on frontend pages
- No rate limiting on API endpoints
- No email verification on signup

### Important
- `next.config.ts` has `ignoreBuildErrors: true` (should fix and remove)
- No error boundaries in frontend
- Limited test coverage (mainly DynamoDB tests)
- No pagination on list endpoints (could timeout with large datasets)

### Nice to Have
- Optimize bundle size (currently no code splitting)
- Add request logging middleware
- Implement caching layer (Redis)
- Dark mode polish (partially implemented)

## Environment Configuration

### Required Environment Variables

#### Backend (`.env`)
```bash
# Security
SECRET_KEY=<generate-with-openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days
REFRESH_TOKEN_EXPIRE_DAYS=30

# AWS Credentials
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
AWS_REGION=ap-southeast-1

# AWS Services
S3_BUCKET_NAME=<your-s3-bucket>
AWS_DYNAMODB_TABLE_NAME=FaceShareData
REKOGNITION_COLLECTION_ID=faceshare-collection

# API Configuration
CORS_ORIGINS=["http://localhost:3000","http://localhost:9002"]
ENVIRONMENT=development  # development | qa | production
```

#### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Environment Switching
```bash
# PowerShell
$env:ENVIRONMENT="qa"

# Bash/Zsh
export ENVIRONMENT=qa

# Or specify file directly
$env:ENV_FILE=".env.qa"
```

## Development Workflow

### Local Development Setup
1. **Clone repository**
2. **Backend setup**:
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1  # Windows
   pip install -r requirements.txt
   cp .env.example .env  # Configure AWS credentials
   ```
3. **Frontend setup**:
   ```bash
   npm install
   cp .env.local.example .env.local  # If exists
   ```
4. **Start backend**: `uvicorn app.main:app --reload` (port 8000)
5. **Start frontend**: `npm run dev` (port 9002)

### Testing
```bash
# Backend tests
cd backend
pytest                    # All tests
pytest test_dynamodb.py -v  # Specific test

# Frontend tests (not yet implemented)
npm test
```

### Deployment
```bash
# Backend (Serverless)
cd infrastructure
serverless deploy --stage qa

# Frontend (Vercel/AWS Amplify)
npm run build
# Deploy via platform
```

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Create new user | No |
| POST | `/auth/login` | Login with email/password | No |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/me` | Get current user | Yes |

### User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/me` | Get user profile | Yes |
| PATCH | `/users/me` | Update user profile | Yes |
| GET | `/users/me/face-profile` | Get face profile images | Yes |
| DELETE | `/users/me/face-profile/{image_id}` | Delete face profile | Yes |

### Event Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/events` | List user's events | Yes |
| POST | `/events` | Create new event | Yes |
| GET | `/events/{id}` | Get event details | Yes |
| PATCH | `/events/{id}` | Update event | Yes (owner only) |
| DELETE | `/events/{id}` | Delete event | Yes (owner only) |
| POST | `/events/join` | Join event via code | Yes |

### Participant Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/events/{id}/participants` | List participants | Yes |
| PATCH | `/events/{id}/participants/{user_id}/approve` | Approve participant | Yes (owner) |
| DELETE | `/events/{id}/participants/{user_id}` | Remove participant | Yes (owner) |

### Image Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/images/presigned-upload` | Get S3 upload URL | Yes |
| POST | `/images/presigned-download` | Get S3 download URL | Yes |
| POST | `/images/face-profile/confirm-upload` | Confirm face profile upload | Yes |

### Face Recognition Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/deepface/register-user/{user_id}` | Register user's face | Yes |
| POST | `/deepface/upload-event-photo/` | Upload & process photo | Yes |
| POST | `/deepface/trigger-batch-scan` | Batch scan event photos | Yes |

## Common Development Tasks

### Adding a New API Endpoint
1. Define Pydantic schemas in `backend/app/schemas/`
2. Create route handler in appropriate `backend/app/api/*.py` file
3. Add DynamoDB operations in `backend/app/core/dynamodb.py` if needed
4. Add to frontend `ApiClient` in `src/lib/api.ts`
5. Update TypeScript types in `src/lib/types.ts`
6. Write tests in `backend/tests/`

### Adding a New Page
1. Create page in `src/app/{route}/page.tsx`
2. Add TypeScript types if needed
3. Wire up API calls using `apiClient`
4. Add route to navigation if needed
5. Test authentication protection if required

### Modifying DynamoDB Schema
1. Update access patterns in `backend/app/core/dynamodb.py`
2. Update entity patterns (PK/SK/GSI)
3. Test with local DynamoDB or DynamoDB Local
4. Plan data migration if changing existing data
5. Update documentation in this file

## Security Considerations

### Authentication
- JWT tokens signed with HS256 algorithm
- Access tokens have 7-day expiry
- Refresh tokens stored separately (30-day expiry)
- Tokens transmitted via Authorization header
- No cookie-based auth (client-side storage)

### Authorization
- All protected routes verify JWT via `get_current_user` dependency
- Owner-only actions check `current_user.id == resource.owner_id`
- Participant-only features check participation status

### Data Privacy
- User face embeddings stored securely
- Photos uploaded directly to S3 (not through backend)
- Event access controlled by join codes
- Participants must be approved by event owner

### Input Validation
- Pydantic models validate all request bodies
- Email validation on registration
- Password minimum length (implement if not present)
- Image file type validation on upload

## Performance Characteristics

### Backend
- **Cold Start**: ~2-3s (Lambda) first request
- **Warm Request**: ~50-200ms for simple queries
- **Face Matching**:
  - Fast path (SFace): ~100ms per photo
  - Slow path (VGG): ~2-5s per photo
- **DynamoDB**: Single-digit millisecond latency

### Frontend
- **Initial Load**: ~1-2s (development)
- **Page Navigation**: <500ms (client-side routing)
- **API Calls**: Depends on backend + network

### Bottlenecks
- Face matching for large events (100+ photos)
- DynamoDB query without pagination
- S3 upload/download for large images
- Frontend bundle size (no code splitting yet)

## Debugging Tips

### Backend Issues
- Check `uvicorn` console for request logs
- Verify `.env` file is loaded correctly (check startup logs)
- Test DynamoDB connection: `aws dynamodb list-tables --region ap-southeast-1`
- Check AWS credentials: `aws sts get-caller-identity`
- Enable debug mode: `uvicorn app.main:app --reload --log-level debug`

### Frontend Issues
- Check browser console for errors
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check Network tab for API request/response
- Clear localStorage if auth is broken
- Check if backend is running: `curl http://localhost:8000/api/v1/docs`

### Face Recognition Issues
- Verify dataset folder structure: `dataset/{user_id}/`
- Check DeepFace model downloads (in `~/.deepface/weights/`)
- Increase similarity threshold if too few matches
- Decrease threshold if too many false positives
- Check face detection: Ensure photo has clear face

## Dependencies Overview

### Backend Key Dependencies
- `fastapi`: Web framework
- `uvicorn`: ASGI server
- `pydantic`: Data validation
- `boto3`: AWS SDK (DynamoDB, S3, Rekognition)
- `python-jose`: JWT handling
- `passlib`: Password hashing
- `python-multipart`: File upload support
- `deepface`: Face recognition (optional, alternative to Rekognition)

### Frontend Key Dependencies
- `next`: Next.js framework
- `react`: UI library
- `typescript`: Type safety
- `tailwindcss`: Styling
- `@radix-ui/*`: UI primitives (via shadcn/ui)
- `genkit`: AI flows (Google)

## Glossary

- **Face Profile**: User's registered face images used for recognition
- **Event**: A gathering/occasion where photos are shared
- **Participant**: User who has joined an event
- **Face Match**: Record linking a photo to a detected user
- **Embedding**: Numerical vector representing a face (used for comparison)
- **Presigned URL**: Temporary S3 URL for direct upload/download
- **Access Code**: Secret code required to join a private event
- **GSI**: Global Secondary Index (DynamoDB)
- **PK/SK**: Partition Key / Sort Key (DynamoDB)

## Questions for Refinement

When refining this document, consider:

1. **Are there any missing features** not documented here?
2. **Are the access patterns** in DynamoDB complete?
3. **Should we document** specific business rules (e.g., max photos per event)?
4. **Is the deployment process** accurate for your setup?
5. **Are there integration points** with other services not mentioned?
6. **Should we add** more details about the face recognition algorithms?
7. **Are there performance targets** we should document (e.g., response time SLAs)?
8. **Should we include** more information about error handling patterns?
9. **Are there compliance requirements** (GDPR, data retention) to document?
10. **Should we add** a troubleshooting section for common issues?

---

**Last Updated**: 2026-03-02
**Maintainers**: Project team
**Related Docs**: [CLAUDE.md](./CLAUDE.md), [rules.md](./rules.md), [prompts.md](./prompts.md)
