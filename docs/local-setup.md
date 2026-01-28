# FaceShare – Local Setup Guide

How to run both the **Next.js frontend** and **FastAPI backend** on your machine.

---

## Prerequisites

| Requirement | Purpose |
|------------|---------|
| **Node.js 18+** | Frontend (Next.js) |
| **npm** or **pnpm** | Frontend deps |
| **Python 3.10+** | Backend (FastAPI) |
| **PostgreSQL 14+** | Backend database |
| **AWS account** (optional for MVP) | S3 presigned uploads; skip S3 initially if needed |

---

## 1. Backend Setup

### 1.1 Create virtual environment (recommended)

```bash
cd backend
python -m venv venv
```

**Windows (PowerShell):**  
If you get *"running scripts is disabled"*, run once:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then activate:
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD)** – no policy change needed:
```cmd
venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 1.2 Install dependencies

```bash
pip install -r requirements.txt
```

### 1.3 Environment variables

```bash
copy .env.example .env   # Windows
# cp .env.example .env  # macOS/Linux
```

Edit `backend/.env`:

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `SECRET_KEY` | ✅ | `openssl rand -hex 32` |
| `DATABASE_URL` | ✅ | `postgresql://user:password@localhost:5432/faceshare` |
| `AWS_ACCESS_KEY_ID` | ⚠️ For S3 | Leave blank to disable S3 |
| `AWS_SECRET_ACCESS_KEY` | ⚠️ For S3 | Leave blank to disable S3 |
| `S3_BUCKET_NAME` | ⚠️ For S3 | e.g. `faceshare-uploads` |
| `CORS_ORIGINS` | ✅ | `["http://localhost:3000","http://localhost:9002"]` |

### 1.4 Database

Create DB (psql or pgAdmin):

```sql
CREATE DATABASE faceshare;
```

Create and run migrations:

```bash
cd backend
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 1.5 Run backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: **http://localhost:8000**
- Docs: **http://localhost:8000/api/v1/docs**

---

## 2. Frontend Setup

### 2.1 Install dependencies

```bash
cd face-share   # project root
npm install
```

### 2.2 Environment (optional)

If the app reads an API base URL from env, add to project root:

```bash
# .env.local (create if needed)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

(Your MVP currently uses mock data; hook this up when you switch to the real API.)

### 2.3 Run frontend

```bash
npm run dev
```

- App: **http://localhost:9002** (see `package.json`)

---

## 3. Run Both

Use two terminals:

| Terminal | Command | URL |
|----------|---------|-----|
| **1** | `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | http://localhost:8000 |
| **2** | `npm run dev` (from project root) | http://localhost:9002 |

---

## 4. Quick Checklist

- [ ] Node.js 18+ and Python 3.10+ installed  
- [ ] PostgreSQL installed and running  
- [ ] `faceshare` database created  
- [ ] `backend/venv` created and activated  
- [ ] `pip install -r requirements.txt` in `backend`  
- [ ] `backend/.env` created from `.env.example` and updated  
- [ ] `SECRET_KEY` set (e.g. `openssl rand -hex 32`)  
- [ ] `DATABASE_URL` correct for your Postgres user/password  
- [ ] `alembic revision --autogenerate -m "Initial migration"`  
- [ ] `alembic upgrade head`  
- [ ] `npm install` in project root  
- [ ] Backend: `uvicorn app.main:app --reload --port 8000`  
- [ ] Frontend: `npm run dev`  

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| **PowerShell: "running scripts is disabled"** | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once, or use **CMD** and `venv\Scripts\activate.bat` |
| **Alembic: "FileNotFoundError: versions directory"** | Create `backend/alembic/versions/` directory: `mkdir backend\alembic\versions` |
| `ModuleNotFoundError: app` | Run commands from `backend/` with venv activated |
| DB connection errors | Check `DATABASE_URL`, Postgres running, `faceshare` exists, `.env` file exists |
| CORS errors | Ensure `CORS_ORIGINS` includes `http://localhost:9002` |
| S3 errors | Set AWS vars or skip image upload until S3 is configured |
| Port in use | Change `--port` for uvicorn or `-p` for Next.js |

---

## 6. API Overview

- **Auth:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`  
- **Users:** `GET /api/v1/users/me`, etc.  
- **Events:** `GET /api/v1/events`, `POST /api/v1/events`, etc.  
- **Docs:** http://localhost:8000/api/v1/docs  

The frontend MVP still uses mock data; integrate these endpoints when you connect the UI to the backend.
