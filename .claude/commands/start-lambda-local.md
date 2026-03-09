# Run Lambda Locally (serverless-offline)

Simulates AWS API Gateway + Lambda on your machine.

**Step 1: Install dependencies (first time only)**
```bash
cd infrastructure
npm install
```

**Step 2: Run**
```bash
cd infrastructure
npx serverless offline --stage dev
```

API will be at: http://localhost:3000

---

## Why use this vs plain uvicorn?

| | uvicorn | serverless-offline |
|---|---|---|
| Speed | Fast | Slower to start |
| Use case | Daily dev | Test Lambda event format |
| Port | 8000 | 3000 |
| Reload | Yes | Yes |

**Rule of thumb:** Use `uvicorn` for daily dev. Use `serverless-offline` only when testing something Lambda-specific (e.g. cold starts, API Gateway headers).
