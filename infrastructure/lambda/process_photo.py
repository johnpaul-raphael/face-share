# infrastructure/lambda/process_photo.py
"""
Lambda function to process event photos from SQS.
Detects faces and matches against user profiles.
"""

import json
import boto3
import os
from decimal import Decimal
import uuid
import time

rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ['DYNAMODB_TABLE']
COLLECTION_ID = os.environ['REKOGNITION_COLLECTION']

def lambda_handler(event, context):
    """
    Process photos from SQS queue.
    Triggered in batches (up to 10 messages at once).
    """
    results = []
    
    for record in event['Records']:
        try:
            # Parse SQS message
            message = json.loads(record['body'])
            event_id = message['event_id']
            photo_id = message['photo_id']
            s3_bucket = message['s3_bucket']
            s3_key = message['s3_key']
            
            print(f"🔄 Processing photo: {photo_id}")
            start_time = time.perf_counter()
            # Step 1: Detect faces
            detect_response = rekognition.detect_faces(
                Image={
                    'S3Object': {
                        'Bucket': s3_bucket,
                        'Name': s3_key
                    }
                },
                Attributes=['DEFAULT']
            )
            
            faces_detected = len(detect_response['FaceDetails'])
            print(f"😊 Detected {faces_detected} faces")
            
            # Step 2: Search for matches
            search_response = rekognition.search_faces_by_image(
                CollectionId=COLLECTION_ID,
                Image={
                    'S3Object': {
                        'Bucket': s3_bucket,
                        'Name': s3_key
                    }
                },
                FaceMatchThreshold=90.0,
                MaxFaces=10
            )
            
            end_time = time.perf_counter()
            elapsed_time = end_time - start_time
            matches = search_response.get('FaceMatches', [])
            print(f"🎯 Found {len(matches)} matches in {elapsed_time:.3f} seconds")
            
            # Step 3: Store results in DynamoDB
            table = dynamodb.Table(TABLE_NAME)
            
            # Update photo record
            table.update_item(
                Key={
                    'PK': f'EVENT#{event_id}',
                    'SK': f'PHOTO#{photo_id}'
                },
                UpdateExpression='SET is_processing = :done, faces_detected = :faces',
                ExpressionAttributeValues={
                    ':done': False,
                    ':faces': faces_detected
                }
            )
            
            # Store each match
            for match in matches:
                face = match['Face']
                match_id = str(uuid.uuid4())
                
                table.put_item(Item={
                    'PK': f'PHOTO#{photo_id}',
                    'SK': f'MATCH#{match_id}',
                    'GSI1PK': f'USER#{face["ExternalImageId"]}',
                    'GSI1SK': f'MATCH#{match_id}',
                    'user_id': face['ExternalImageId'],
                    'photo_id': photo_id,
                    'event_id': event_id,
                    'confidence': Decimal(str(match['Similarity'])),
                    'rekognition_face_id': face['FaceId'],
                    'is_confirmed': False
                })
                
                print(f"   ✅ Match: {face['ExternalImageId']} ({match['Similarity']:.1f}%)")
            
            results.append({
                'photo_id': photo_id,
                'faces_detected': faces_detected,
                'matches_found': len(matches),
                'status': 'success'
            })
            
        except Exception as e:
            print(f"❌ Error processing record: {str(e)}")
            # Don't raise - let other records process
            # Failed messages will go to DLQ (Dead Letter Queue)
            results.append({
                'photo_id': photo_id,
                'error': str(e),
                'status': 'failed'
            })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed': len(event['Records']),
            'results': results
        })
    }
