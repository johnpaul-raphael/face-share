# infrastructure/lambda/index_face.py
"""
Lambda function to index faces from profile photos.
Triggered when user uploads a profile photo.
"""

import json
import boto3
import os
from decimal import Decimal
import time

# Initialize clients
rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

TABLE_NAME = os.environ['DYNAMODB_TABLE']
COLLECTION_ID = os.environ['REKOGNITION_COLLECTION']
QUEUE_URL = os.environ['SQS_QUEUE_URL']

def lambda_handler(event, context):
    """
    Index a face from S3 image into Rekognition collection.
    
    Expected event:
    {
        "user_id": "uuid",
        "image_id": "uuid",
        "s3_bucket": "faceshare-events",
        "s3_key": "users/uuid/face-profile/image.jpg"
    }
    """
    try:
        # Parse input
        user_id = event['user_id']
        image_id = event['image_id']
        s3_bucket = event['s3_bucket']
        s3_key = event['s3_key']
        start_time = time.perf_counter()
        print(f"🔄 Indexing face for user: {user_id}")
        
        # Index face in Rekognition
        response = rekognition.index_faces(
            CollectionId=COLLECTION_ID,
            Image={
                'S3Object': {
                    'Bucket': s3_bucket,
                    'Name': s3_key
                }
            },
            ExternalImageId=user_id,  # Link to user
            DetectionAttributes=['ALL']
        )
        
        if not response['FaceRecords']:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No face detected'})
            }
        
        face_record = response['FaceRecords'][0]
        face_id = face_record['Face']['FaceId']
        confidence = face_record['Face']['Confidence']
        
        # Store in DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        table.put_item(Item={
            'PK': f'USER#{user_id}',
            'SK': f'FACE#{image_id}',
            'face_id': face_id,
            's3_key': s3_key,
            'confidence': Decimal(str(confidence)),
            'indexed_at': context.aws_request_id
        })
        end_time = time.perf_counter()
        elapsed_time = end_time - start_time
        print(f"✅ Face indexed: {face_id} in {elapsed_time:.3f} seconds")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'face_id': face_id,
                'confidence': float(confidence)
            })
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
