# Deploy to AWS Lambda

Deploys the backend to AWS Lambda via Serverless Framework.

**Step 1: Make sure AWS credentials are set in backend/.env**
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- SECRET_KEY (JWT secret)

**Step 2: Deploy**
```bash
cd infrastructure
npx serverless deploy --stage dev
```

**What happens under the hood:**
1. Serverless Framework packages your Python code + dependencies
2. Uploads a .zip to S3
3. Creates/updates Lambda functions
4. Creates API Gateway routes that point to the Lambda
5. Outputs the live URL when done

**To remove/teardown:**
```bash
npx serverless remove --stage dev
```

**Check logs after deploy:**
```bash
npx serverless logs --function api --stage dev --tail
```
