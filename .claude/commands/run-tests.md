# Run Backend Tests

```bash
cd backend
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate

# Run all tests
pytest -v

# Run a specific test file
pytest test_rekognition.py -v
pytest test_dynamodb.py -v

# Run with detailed output on failure
pytest -v --tb=short
```

**Test files in this project:**
- `test_rekognition.py` — Tests AWS Rekognition face matching
- `test_dynamodb.py` — Tests DynamoDB read/write
- `test_face_upload.py` — Tests face image upload flow
- `tests/` folder — API endpoint tests
