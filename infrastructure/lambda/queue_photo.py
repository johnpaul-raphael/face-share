# infrastructure/lambda/queue_photo.py
"""
Lambda function triggered by S3 upload.
Sends photo info to SQS for processing.
"""

import json
import boto3
import os
import urllib.parse
import time

sqs = boto3.client('sqs')
QUEUE_URL = os.environ['SQS_QUEUE_URL']

def lambda_handler(event, context):
    """
    Triggered by S3 upload event.
    Sends photo details to SQS queue.
    """
    try:
        # Parse S3 event
        start_time = time.perf_counter()
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = urllib.parse.unquote_plus(
                record['s3']['object']['key'],
                encoding='utf-8'
            )
            
            # Extract event_id and photo_id from path
            # Format: events/{event_id}/photos/{photo_id}/{filename}
            parts = key.split('/')
            if len(parts) < 4:
                print(f"⚠️  Invalid path format: {key}")
                continue
            
            event_id = parts[1]
            photo_id = parts[3]
            
            print(f"📸 New photo uploaded: {key}")
            
            # Send to SQS
            message = {
                'event_id': event_id,
                'photo_id': photo_id,
                's3_bucket': bucket,
                's3_key': key,
                'uploaded_at': record['eventTime']
            }
            
            sqs.send_message(
                QueueUrl=QUEUE_URL,
                MessageBody=json.dumps(message)
            )
            
            print(f"✅ Queued for processing: {photo_id}")
        end_time = time.perf_counter()
        elapsed_time = end_time - start_time
        print(f"✅ Queue processing completed in: {elapsed_time:.3f} seconds")
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Photos queued'})
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
