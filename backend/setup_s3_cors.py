"""
Setup S3 CORS configuration for FaceShare

This script configures the S3 bucket to allow direct uploads from the browser.
Run this once after creating your S3 bucket.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

def setup_s3_cors():
    """Configure S3 bucket CORS policy"""

    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

    # CORS configuration
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                'AllowedOrigins': settings.CORS_ORIGINS,
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3000
            }
        ]
    }

    try:
        print(f"🔧 Configuring CORS for bucket: {settings.S3_BUCKET_NAME}")
        print(f"   Allowed origins: {settings.CORS_ORIGINS}\n")

        s3_client.put_bucket_cors(
            Bucket=settings.S3_BUCKET_NAME,
            CORSConfiguration=cors_configuration
        )

        print("✅ CORS configuration applied successfully!")

        # Verify the configuration
        response = s3_client.get_bucket_cors(Bucket=settings.S3_BUCKET_NAME)
        print("\n📋 Current CORS Rules:")
        for i, rule in enumerate(response['CORSRules'], 1):
            print(f"\n   Rule {i}:")
            print(f"      Allowed Origins: {rule.get('AllowedOrigins', [])}")
            print(f"      Allowed Methods: {rule.get('AllowedMethods', [])}")
            print(f"      Allowed Headers: {rule.get('AllowedHeaders', [])}")
            print(f"      Expose Headers:  {rule.get('ExposeHeaders', [])}")
            print(f"      Max Age:         {rule.get('MaxAgeSeconds', 0)} seconds")

        print("\n✅ S3 CORS setup complete! Browser uploads should now work.")

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ Error: Bucket '{settings.S3_BUCKET_NAME}' does not exist")
            print(f"   Create the bucket first using AWS Console or CLI")
        elif error_code == 'AccessDenied':
            print(f"❌ Error: Access denied")
            print(f"   Ensure your AWS credentials have s3:PutBucketCors permission")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("="*60)
    print("S3 CORS Configuration Tool")
    print("="*60)
    print(f"Bucket:  {settings.S3_BUCKET_NAME}")
    print(f"Region:  {settings.AWS_REGION}")
    print(f"Origins: {settings.CORS_ORIGINS}")
    print("="*60 + "\n")

    setup_s3_cors()
