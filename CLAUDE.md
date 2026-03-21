# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FaceShare** is a photo-sharing app that uses face recognition to automatically deliver event photos to the people who appear in them. Users register face profiles, join events, and receive only the photos they appear in.

## Architecture

This is a **monorepo** with two separate applications:

- **Frontend** (`/` root): Next.js 15 app with React 19, Turbopack, shadcn/ui + Radix UI, TailwindCSS
- **Backend** (`backend/`): FastAPI (Python) REST API

### Frontend → Backend Communication

The frontend calls the backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`). The `ApiClient` class in `src/lib/api.ts` handles all HTTP calls and reads `access_token` / `refresh_token` from `localStorage`.

**Important**: Some pages still use mock data from `src/lib/data.ts` and have not yet been fully wired to the backend API.

### Backend Data Layer

The backend uses **AWS DynamoDB** as its sole database. All data lives in a single table `FaceShareData` with composite keys:

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| User | `USER#{id}` | `PROFILE` | `EMAIL#{email}` | `USER#{id}` |
| Face profile | `USER#{id}` | `FACE#{image_id}` | — | — |
| Event | `EVENT#{id}` | `METADATA` | `USER#{owner_id}` | `EVENT#{id}` |
| Participant | `EVENT#{id}` | `USER#{user_id}` | `USER#{user_id}` | `EVENT#{id}` |
| Photo | `EVENT#{id}` | `PHOTO#{id}` | `USER#{uploader_id}` | `PHOTO#{id}` |
| Face match | `PHOTO#{id}` | `MATCH#{id}` | `USER#{user_id}` | `MATCH#{id}` |

The `DynamoDBService` singleton is in `backend/app/core/dynamodb.py`. Auth helpers (`get_user_by_id`, `authenticate_user`, `create_user`) live in `backend/app/services/dynamodb_auth_service.py`.

### Face Recognition

Two face matching pipelines exist in `backend/app/api/deepface.py`:
- **Fast path** (default): SFace model with cached embeddings; threshold 0.55 cosine distance
- **Slow path**: VGG-Face with `DeepFace.find()` against the dataset folder

Known faces are stored in `./dataset/{user_id}/` folders. Event photos go to `./event_uploads/`.

### AI Flows (Genkit)

`src/ai/` contains Google Genkit flows using Gemini 2.5 Flash (`googleai/gemini-2.5-flash`). Flows are in `src/ai/flows/`. The Genkit dev server runs separately from Next.js.

## Commands

### Frontend

```bash
# Install dependencies
npm install

# Run dev server (port 9002, Turbopack)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Type check
npm run typecheck

# Genkit AI dev server
npm run genkit:dev
npm run genkit:watch
```

### Backend

```bash
cd backend

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
venv\Scripts\activate.bat
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run dev server (port 8000, auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run a single test file
pytest test_dynamodb.py -v
```

## Environment Setup

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Notes |
|----------|-------|
| `SECRET_KEY` | Generate with `openssl rand -hex 32` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for DynamoDB + S3 |
| `AWS_REGION` | e.g. `ap-southeast-1` |
| `S3_BUCKET_NAME` | S3 bucket for image storage |
| `CORS_ORIGINS` | JSON array: `["http://localhost:3000","http://localhost:9002"]` |

Switch environments via `ENVIRONMENT=qa|production` or `ENV_FILE=.env.qa`.

### Frontend (`/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Backend API Routes

All routes are prefixed with `/api/v1`. Auth is JWT Bearer token.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `GET|PATCH /users/me`, `GET /users/me/face-profile`, `DELETE /users/me/face-profile/{image_id}`
- `GET|POST /events`, `GET|PATCH|DELETE /events/{id}`, `POST /events/join`
- `GET /events/{id}/participants`, `PATCH .../participants/{user_id}/approve`, `DELETE .../participants/{user_id}`
- `POST /images/presigned-upload`, `POST /images/presigned-download`, `POST /images/face-profile/confirm-upload`
- `POST /deepface/register-user/{user_id}`, `POST /deepface/upload-event-photo/`, `POST /deepface/trigger-batch-scan`

API docs available at `http://localhost:8000/docs` (or `/api/v1/docs`).

## Key Files

| Path | Purpose |
|------|---------|
| `src/lib/api.ts` | Frontend `ApiClient` – all backend HTTP calls |
| `src/lib/types.ts` | Shared TypeScript types (User, Event, Photo, FaceMatch) |
| `src/lib/data.ts` | Mock data (used by pages not yet connected to backend) |
| `backend/app/core/dynamodb.py` | `DynamoDBService` – all DynamoDB CRUD |
| `backend/app/core/config.py` | `Settings` via pydantic-settings; multi-env support |
| `backend/app/core/security.py` | JWT signing/decoding, bcrypt password hashing |
| `backend/app/api/deps.py` | `get_current_user` FastAPI dependency |
| `backend/app/api/deepface.py` | Face recognition endpoints (DeepFace/SFace) |
| `backend/app/services/dynamodb_auth_service.py` | Auth helpers wrapping DynamoDB |

## Frontend Structure

- `src/app/` — Next.js App Router pages: `/login`, `/signup`, `/dashboard`
- `src/components/ui/` — shadcn/ui components
- `src/components/` — App-level components (dialogs, nav, logo)
- `src/hooks/` — Custom React hooks
- `src/ai/flows/` — Genkit AI flows
- `src/lib/` — Utilities, API client, types, mock data

## Notes

- `next.config.ts` has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` for TypeScript/ESLint — fix errors rather than relying on this.
- The frontend stores JWT tokens in `localStorage` (not cookies).
- The `deepface.py` router has hardcoded absolute Windows paths (`D:/JOHNPAUL/...`) for local development that must be updated for deployment.
- The infrastructure directory contains a Serverless Framework config (`serverless.yml`) for Lambda deployment.

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
