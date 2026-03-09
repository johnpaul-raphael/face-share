# Check Environment Setup

Verify your local environment is correctly configured.

## Backend checklist
```bash
# 1. Does .env exist?
test -f backend/.env && echo "✓ backend/.env found" || echo "✗ MISSING: copy backend/.env.example to backend/.env"

# 2. Can Python import the app?
cd backend && source venv/Scripts/activate 2>/dev/null || source venv/bin/activate
python -c "from app.main import app; print('✓ FastAPI app loads OK')"

# 3. Can we reach AWS DynamoDB?
python -c "from app.core.dynamodb import db; print('✓ DynamoDB connected')"
```

## Frontend checklist
```bash
# Does .env.local exist?
test -f .env.local && echo "✓ .env.local found" || echo "✗ Create .env.local with: NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1"
```

## Ports to remember
- Frontend: http://localhost:9002
- Backend:  http://localhost:8000
- API docs: http://localhost:8000/docs
