# Face Profile Upload Debug Report

## Issue
Face profile upload is not working - nothing happens when trying to upload images on the profile page.

## Investigation Summary

### ✅ What's Working
1. **Backend Configuration**: AWS S3, DynamoDB, and Rekognition are properly configured
2. **Presigned URL Generation**: Backend can successfully generate presigned S3 upload URLs
3. **Face Recognition**: Rekognition collection exists and is ready
4. **API Endpoints**: All required endpoints exist:
   - `POST /api/v1/images/presigned-upload`
   - `POST /api/v1/images/face-profile/confirm-upload`
   - `GET /api/v1/users/me/face-profile`

### ❌ Potential Issues Found

#### 1. **CORS Configuration Parsing Issue**
**Location**: `backend/.env`

The `.env` file has duplicate `CORS_ORIGINS` entries (lines 8 and 32), and the parsed value shows incorrect formatting:
```
CORS_ORIGINS: ['[\\"http://localhost:3000\\"', '\\"http://localhost:9002\\"]']
```

This should be:
```
CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:9002']
```

**Fix**: Remove duplicate entry and ensure proper format in `.env`

#### 2. **Missing Error Handling Visibility**
**Location**: `src/app/dashboard/profile/page.tsx:114-121`

The upload error handler catches errors but may not be providing enough detail:
```typescript
catch (err) {
  URL.revokeObjectURL(blobUrl);
  setFaceImages((prev) => prev.filter((img) => img.id !== localId));
  toast({
    variant: 'destructive',
    title: 'Upload failed',
    description: err instanceof Error ? err.message : 'Please try again.',
  });
}
```

**Issue**: If the error is a network/CORS error, the error message might not be helpful.

#### 3. **Consent Checkbox Requirement**
**Location**: `src/app/dashboard/profile/page.tsx:79-82`

Users **must** check the consent checkbox before uploading. If they click the upload button without checking the box, nothing happens (except a toast notification).

```typescript
if (!hasConsented) {
  toast({ variant: 'destructive', title: 'Consent required', description: 'Please check the consent box before uploading.' });
  return;
}
```

**Check**: Verify the user is checking the consent box.

## Root Cause Analysis

The most likely causes in order of probability:

### 1. **User hasn't checked the consent checkbox** (Most Likely)
- The consent checkbox at the bottom must be checked before upload
- When unchecked, clicking upload shows a toast but no other visual feedback
- **Solution**: Check the consent box before attempting upload

### 2. **CORS blocking the API request**
- Incorrectly parsed CORS origins may block frontend requests
- Browser console would show CORS errors
- **Solution**: Fix CORS configuration in backend

### 3. **Network/API errors not surfacing**
- Backend might be returning errors that aren't visible to user
- **Solution**: Check browser DevTools Network tab and Console

## Recommended Debugging Steps

### Step 1: Check Browser Console
Open DevTools (F12) → Console tab and look for:
- CORS errors (red text about "Access-Control-Allow-Origin")
- Network errors
- JavaScript errors

### Step 2: Check Network Tab
Open DevTools → Network tab and:
1. Try to upload an image
2. Look for requests to `/api/v1/images/presigned-upload`
3. Check if request is made, what status code it returns
4. Check if CORS preflight OPTIONS request succeeds

### Step 3: Verify Consent Checkbox
Ensure the consent checkbox is checked before clicking upload button.

### Step 4: Fix CORS Configuration
Edit `backend/.env`:
```env
# Remove duplicate on line 8, keep only:
CORS_ORIGINS=http://localhost:3000,http://localhost:9002
```

Then restart backend:
```bash
cd backend
# Kill the running server (Ctrl+C)
# Restart it
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 5: Test with Enhanced Logging
Add console.log to see what's happening:

In `src/app/dashboard/profile/page.tsx`, add logging to `handleFileSelect`:
```typescript
const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
  console.log('🔍 Upload started, hasConsented:', hasConsented);

  if (!hasConsented) {
    console.log('❌ Upload blocked - consent required');
    toast({ variant: 'destructive', title: 'Consent required', description: 'Please check the consent box before uploading.' });
    return;
  }

  const files = event.target.files;
  console.log('📁 Files selected:', files?.length);

  if (!files || files.length === 0) return;

  // ... rest of code
  try {
    console.log('🌐 Getting presigned URL...');
    const { upload_url, s3_key, face_image_id } = await apiClient.getPresignedUpload({
      filename: file.name,
      content_type: file.type || 'image/jpeg',
    });
    console.log('✅ Got presigned URL, uploading to S3...');

    await apiClient.uploadToS3(upload_url, file, () => {});
    console.log('✅ S3 upload complete, confirming...');

    await apiClient.confirmFaceProfileUpload(face_image_id!, s3_key);
    console.log('✅ Upload confirmed!');

    // ... rest of success code
  } catch (err) {
    console.error('❌ Upload error:', err);
    // ... existing error handling
  }
}
```

## Quick Fix Checklist

- [ ] Check consent checkbox is checked before upload
- [ ] Fix duplicate CORS_ORIGINS in backend/.env
- [ ] Restart backend server
- [ ] Check browser console for errors
- [ ] Check browser network tab for failed requests
- [ ] Verify API_URL environment variable in frontend (.env.local)
- [ ] Ensure backend is running on port 8000
- [ ] Ensure frontend is running on port 9002

## Expected Behavior

When upload works correctly:
1. User checks consent checkbox
2. User clicks "+" button to select file
3. File picker opens
4. User selects image file(s)
5. Image appears with loading spinner
6. Backend processes upload
7. Image appears with actual photo
8. Success toast appears

## Next Steps

1. **Immediate**: Check if consent checkbox is checked
2. **If that's not it**: Check browser console for errors
3. **If CORS errors**: Fix backend/.env CORS configuration
4. **If still failing**: Add enhanced logging and share console output
