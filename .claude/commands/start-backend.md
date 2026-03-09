# Start Backend (Local Dev)

Run this to start the FastAPI backend on port 8000.

```bash
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**What this does:**
- Activates the Python virtual environment
- Starts the FastAPI server with hot-reload (auto-restarts when you change code)
- API available at: http://localhost:8000
- Swagger docs at: http://localhost:8000/docs
