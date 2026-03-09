# Face Profile Upload Fix - Troubleshooting Guide

## Problem
Unable to upload face profile photos.

## Root Causes Identified

### 1. S3 CORS Configuration (Most Likely Issue)
S3 buckets need CORS configuration to allow direct browser uploads. Without this, the browser will block the PUT request to S3.

### 2. CORS Origins Parsing (Fixed)
The backend CORS_ORIGINS was being parsed incorrectly, which could cause issues with API requests.

## Solutions Applied

### ✅ Fixed: CORS Origins Parsing
**File**: `backend/app/core/config.py`
**Change**: Improved the `parse_cors_origins` validator to handle both string and list types correctly.

The CORS_ORIGINS in `.env` should be comma-separated:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:9002
```

### 🔧 Required: S3 CORS Configuration

**IMPORTANT**: You must configure CORS on your S3 bucket to allow browser uploads.

#### Option 1: Run the Setup Script
```bash
cd backend
python setup_s3_cors.py
```

This will automatically configure your S3 bucket with the correct CORS rules.

#### Option 2: Manual Configuration via AWS Console

1. Go to AWS S3 Console
2. Select your bucket (`faceshare-events2`)
3. Go to **Permissions** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit** and paste this configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:9002"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. Click **Save changes**

## Testing the Fix

### 1. Test Backend Configuration
```bash
cd backend
python test_face_upload.py
```

Expected output: All checks should pass ✅

### 2. Test S3 CORS Configuration
```bash
cd backend
python -c "import boto3; from app.core.config import settings; s3 = boto3.client('s3', region_name=settings.AWS_REGION); cors = s3.get_bucket_cors(Bucket=settings.S3_BUCKET_NAME); print('CORS Rules:', cors['CORSRules'])"
```

### 3. Test from Frontend
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `npm run dev`
3. Navigate to http://localhost:9002/dashboard/profile
4. Check the consent checkbox
5. Click the upload button and select a photo of your face
6. Watch the browser console for errors

### 4. Check Browser Console
If the upload still fails, open browser DevTools (F12) and check:
- **Console tab**: Look for error messages
- **Network tab**:
  - Find the request to `/images/presigned-upload` - should return 200
  - Find the PUT request to `s3.amazonaws.com` - should return 200
  - Find the request to `/images/face-profile/confirm-upload` - should return 200

## Common Error Messages and Solutions

### Error: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"
**Solution**: Configure S3 CORS (see above)

### Error: "Failed to generate presigned URL"
**Solutions**:
- Check AWS credentials in `backend/.env`
- Verify S3 bucket exists and you have access
- Check AWS_REGION matches your bucket region

### Error: "No face detected in the uploaded image"
**Solution**: Upload a clear photo with a visible face

### Error: "You can have at most 5 face profile images"
**Solution**: Delete some existing face profile images first

### Error: "Consent required"
**Solution**: Check the consent checkbox before uploading

## Verification Checklist

- [ ] Backend `.env` file has correct AWS credentials
- [ ] S3 bucket `faceshare-events2` exists in `us-east-1` region
- [ ] S3 bucket has CORS configuration applied
- [ ] Rekognition collection `faceshare-collection` exists
- [ ] CORS_ORIGINS in `.env` includes `http://localhost:9002`
- [ ] Backend server is running on port 8000
- [ ] Frontend is running on port 9002
- [ ] Browser console shows no CORS errors

## Test Upload Flow

The complete flow for face profile upload:

1. **Frontend**: User selects image file
2. **Frontend → Backend**: POST `/api/v1/images/presigned-upload`
   - Request body: `{ filename: "photo.jpg", content_type: "image/jpeg" }`
   - Response: `{ upload_url: "https://...", s3_key: "users/...", face_image_id: "..." }`

3. **Frontend → S3**: PUT to presigned URL
   - Direct upload to S3 (bypasses backend)
   - Must include `Content-Type` header
   - **Requires S3 CORS to be configured**

4. **Frontend → Backend**: POST `/api/v1/images/face-profile/confirm-upload`
   - Request: `{ face_image_id: "...", s3_key: "..." }`
   - Backend indexes face with Rekognition
   - Stores face profile in DynamoDB
   - Response: `{ id: "...", s3_key: "...", url: "..." }`

5. **Frontend**: Refreshes face profile to show uploaded image

## Additional Debugging

### Enable Verbose Logging
In `backend/app/main.py`, add at the top:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check S3 Bucket Policy
Ensure your S3 bucket allows uploads. Check bucket policy in AWS Console.

### Check Rekognition Collection
```bash
cd backend
python -c "from app.core.rekognition import rekognition_service; print(rekognition_service.client.list_collections())"
```

Should show `{'CollectionIds': ['faceshare-collection'], ...}`

### Test Presigned URL Manually
1. Get a presigned upload URL from the API
2. Use curl or Postman to upload a file:
   ```bash
   curl -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "PRESIGNED_URL_HERE"
   ```

## Environment Variables Reference

From `backend/.env`:
```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=faceshare-events2
S3_PRESIGNED_URL_EXPIRATION=3600

# CORS (must include frontend URL)
CORS_ORIGINS=http://localhost:3000,http://localhost:9002

# Rekognition
REKOGNITION_COLLECTION_ID=faceshare-collection
```

## Summary

The face profile upload issue is most likely caused by **missing S3 CORS configuration**.

**Quick Fix**:
1. Run `cd backend && python setup_s3_cors.py`
2. Restart the backend server
3. Try uploading again

If issues persist, follow the troubleshooting steps above and check browser console for specific error messages.
