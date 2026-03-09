"""
FaceShare Configuration Test Script

This script tests the multi-environment configuration system.
It demonstrates how the application loads different configurations
based on environment variables.

Usage:
    # Test default (development) environment
    python test_config.py
    
    # Test QA environment
    $env:ENVIRONMENT="qa"  # PowerShell
    python test_config.py
    
    # Test production environment
    $env:ENVIRONMENT="production"
    python test_config.py

What This Tests:
    ✅ Environment file loading
    ✅ AWS credentials configuration
    ✅ S3 bucket settings
    ✅ Database URL
    ✅ Security settings
    ✅ CORS origins
"""

import sys
import os

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import after path setup
from app.core.config import settings


def test_configuration():
    """
    Test and display all configuration settings.
    
    This function prints out all loaded settings so you can verify
    that the correct environment file is being loaded.
    """
    
    print("\n" + "="*60)
    print("🧪 FACE SHARE CONFIGURATION TEST")
    print("="*60)
    
    # Environment Information
    print("\n📍 ENVIRONMENT")
    print("-" * 40)
    print(f"Current Environment:  {settings.ENVIRONMENT}")
    print(f"Is Development:       {settings.is_development}")
    print(f"Is QA:                {settings.is_qa}")
    print(f"Is Production:        {settings.is_production}")
    
    # Application Settings
    print("\n📱 APPLICATION")
    print("-" * 40)
    print(f"Project Name:         {settings.PROJECT_NAME}")
    print(f"Version:              {settings.VERSION}")
    print(f"API Base Path:        {settings.API_V1_STR}")
    
    # AWS Settings
    print("\n☁️  AWS CONFIGURATION")
    print("-" * 40)
    print(f"AWS Region:           {settings.AWS_REGION}")
    print(f"S3 Bucket:            {settings.S3_BUCKET_NAME}")
    print(f"Presigned URL Expiry: {settings.S3_PRESIGNED_URL_EXPIRATION} seconds")
    
    # Mask AWS credentials for security
    access_key = settings.AWS_ACCESS_KEY_ID
    if access_key:
        masked_key = access_key[:4] + "****" + access_key[-4:] if len(access_key) > 8 else "****"
        print(f"AWS Access Key ID:    {masked_key}")
    else:
        print("AWS Access Key ID:    ❌ NOT SET")
        print("⚠️  Warning: AWS credentials not configured!")
    
    if settings.AWS_SECRET_ACCESS_KEY:
        print(f"AWS Secret Key:       ✅ SET (hidden for security)")
    else:
        print(f"AWS Secret Key:       ❌ NOT SET")
    
    # Database Settings
    print("\n🗄️  DATABASE")
    print("-" * 40)
    print(f"Database URL:         {settings.DATABASE_URL}")
    print(f"Is Local Database:    {settings.is_local_database}")
    
    # Security Settings
    print("\n🔒 SECURITY")
    print("-" * 40)
    print(f"Algorithm:            {settings.ALGORITHM}")
    print(f"Token Expiry:         {settings.ACCESS_TOKEN_EXPIRE_MINUTES} minutes")
    print(f"Refresh Token Days:   {settings.REFRESH_TOKEN_EXPIRE_DAYS} days")
    
    # Mask secret key
    secret = settings.SECRET_KEY
    if secret and len(secret) > 8:
        masked_secret = secret[:4] + "..." + secret[-4:]
        print(f"Secret Key:           {masked_secret}")
    else:
        print(f"Secret Key:           ❌ NOT SET OR TOO SHORT")
        print("⚠️  Warning: Secret key should be at least 32 characters!")
    
    # CORS Settings
    print("\n🌐 CORS ORIGINS")
    print("-" * 40)
    origins = settings.CORS_ORIGINS
    if isinstance(origins, list):
        for origin in origins:
            print(f"  • {origin}")
    else:
        print(f"  • {origins}")
    
    print("\n" + "="*60)
    print("✅ CONFIGURATION TEST COMPLETE")
    print("="*60)
    
    # Validation warnings
    print("\n🔍 VALIDATION CHECKS:")
    
    warnings = []
    errors = []
    
    # Check AWS credentials
    if not settings.AWS_ACCESS_KEY_ID or settings.AWS_ACCESS_KEY_ID == "your-aws-access-key-id":
        errors.append("❌ AWS_ACCESS_KEY_ID not set or using placeholder value")
    
    if not settings.AWS_SECRET_ACCESS_KEY or settings.AWS_SECRET_ACCESS_KEY == "your-aws-secret-access-key":
        errors.append("❌ AWS_SECRET_ACCESS_KEY not set or using placeholder value")
    
    # Check secret key
    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        warnings.append("⚠️  SECRET_KEY should be at least 32 characters for security")
    
    # Check S3 bucket
    if "yourname" in settings.S3_BUCKET_NAME or "example" in settings.S3_BUCKET_NAME:
        warnings.append("⚠️  S3_BUCKET_NAME contains placeholder text")
    
    # Print results
    if errors:
        print("\n🚨 ERRORS (Must Fix):")
        for error in errors:
            print(f"  {error}")
    
    if warnings:
        print("\n⚠️  WARNINGS (Recommended):")
        for warning in warnings:
            print(f"  {warning}")
    
    if not errors and not warnings:
        print("✅ All checks passed! Configuration looks good.")
    
    print("\n" + "="*60)
    
    return len(errors) == 0


def test_s3_integration():
    """
    Test S3 connectivity and operations.
    
    This tests:
    - S3 client initialization
    - Bucket existence
    - Presigned URL generation
    """
    print("\n🪣 TESTING S3 INTEGRATION")
    print("="*60)
    
    try:
        from app.core.s3 import (
            s3_client,
            generate_presigned_upload_url,
            get_s3_key_for_photo,
            get_s3_key_for_face_profile,
            settings as s3_settings
        )
        
        print(f"\nS3 Bucket: {s3_settings.S3_BUCKET_NAME}")
        print(f"AWS Region: {s3_settings.AWS_REGION}")
        
        # Test 1: Check if bucket exists
        print("\n📋 Test 1: Checking S3 bucket...")
        try:
            s3_client.head_bucket(Bucket=s3_settings.S3_BUCKET_NAME)
            print("✅ Bucket exists and is accessible")
        except Exception as e:
            print(f"❌ Bucket check failed: {e}")
            print("   Make sure the bucket name is correct and you have permissions")
            return False
        
        # Test 2: Generate presigned URL for profile upload
        print("\n📋 Test 2: Generating profile upload URL...")
        profile_key = get_s3_key_for_face_profile(
            "test-user-123",
            "test-face-456",
            "profile.jpg"
        )
        profile_url = generate_presigned_upload_url(profile_key)
        
        if profile_url:
            print(f"✅ Profile upload URL generated")
            print(f"   Key: {profile_key}")
            print(f"   URL: {profile_url[:80]}...")
        else:
            print("❌ Failed to generate profile upload URL")
            return False
        
        # Test 3: Generate presigned URL for event photo
        print("\n📋 Test 3: Generating event photo upload URL...")
        photo_key = get_s3_key_for_photo(
            "test-event-789",
            "test-photo-000",
            "wedding.jpg"
        )
        photo_url = generate_presigned_upload_url(photo_key)
        
        if photo_url:
            print(f"✅ Event photo upload URL generated")
            print(f"   Key: {photo_key}")
            print(f"   URL: {photo_url[:80]}...")
        else:
            print("❌ Failed to generate event photo URL")
            return False
        
        print("\n✅ S3 Integration Tests Passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ S3 Integration Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def show_environment_help():
    """
    Display help for switching environments.
    """
    print("""
🔄 SWITCHING ENVIRONMENTS
========================

PowerShell:
    $env:ENVIRONMENT="qa"
    python test_config.py
    
    $env:ENVIRONMENT="production"
    python test_config.py

Windows CMD:
    set ENVIRONMENT=qa
    python test_config.py

Linux/Mac:
    export ENVIRONMENT=qa
    python test_config.py

Or specify file directly:
    $env:ENV_FILE=".env.qa"
    python test_config.py

FILES NEEDED:
    .env        - Development (default)
    .env.qa     - QA/Staging
    .env.prod   - Production
    
Create from template:
    copy .env.example .env
    # Edit .env with your credentials
""")


if __name__ == "__main__":
    """
    Main entry point for configuration testing.
    Run this script to verify your setup.
    """
    
    # Test basic configuration
    config_ok = test_configuration()
    
    # Test S3 integration (only if basic config is OK)
    if config_ok:
        s3_ok = test_s3_integration()
    else:
        print("\n⏭️  Skipping S3 tests due to configuration errors")
        s3_ok = False
    
    # Show help
    show_environment_help()
    
    # Final summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"Configuration:  {'✅ PASS' if config_ok else '❌ FAIL'}")
    print(f"S3 Integration: {'✅ PASS' if s3_ok else '❌ FAIL'}")
    print("="*60)
    
    # Exit with appropriate code
    sys.exit(0 if (config_ok and s3_ok) else 1)