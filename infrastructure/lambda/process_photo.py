# infrastructure/lambda/process_photo.py
"""
Lambda function to process event photos from SQS.
Detects faces and matches against the event's participants only.
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
FACE_MATCH_THRESHOLD = float(os.environ.get('FACE_MATCH_THRESHOLD', '80.0'))


def _get_event_participant_ids(table, event_id: str) -> set:
    """Query DynamoDB for all participant user_ids in an event."""
    participant_ids = set()
    kwargs = {
        'KeyConditionExpression': 'PK = :pk AND begins_with(SK, :sk)',
        'ExpressionAttributeValues': {
            ':pk': f'EVENT#{event_id}',
            ':sk': 'USER#',
        },
        'ProjectionExpression': 'user_id',
    }
    while True:
        response = table.query(**kwargs)
        for item in response.get('Items', []):
            uid = item.get('user_id')
            if uid:
                participant_ids.add(uid)
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        kwargs['ExclusiveStartKey'] = last_key
    return participant_ids


def lambda_handler(event, context):  # noqa: ARG001 — context required by Lambda signature
    """
    Process photos from SQS queue.
    Triggered in batches (up to 10 messages at once).
    """
    table = dynamodb.Table(TABLE_NAME)
    results = []

    for record in event['Records']:
        photo_id = None
        try:
            message = json.loads(record['body'])
            event_id = message['event_id']
            photo_id = message['photo_id']
            s3_bucket = message['s3_bucket']
            s3_key = message['s3_key']

            print(f"Processing photo: {photo_id} for event: {event_id}")
            start_time = time.perf_counter()

            # Step 1: Detect faces
            detect_response = rekognition.detect_faces(
                Image={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
                Attributes=['DEFAULT'],
            )
            faces_detected = len(detect_response['FaceDetails'])
            print(f"Detected {faces_detected} face(s)")

            # Step 2: Search for matches in Rekognition collection
            search_response = rekognition.search_faces_by_image(
                CollectionId=COLLECTION_ID,
                Image={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
                FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                MaxFaces=10,
            )
            raw_matches = search_response.get('FaceMatches', [])
            print(f"Found {len(raw_matches)} Rekognition match(es)")

            # Step 3: Filter to event participants only (privacy: don't leak photos to non-members)
            participant_ids = _get_event_participant_ids(table, event_id)

            # Deduplicate by user_id — keep best similarity per user
            best_by_user: dict[str, float] = {}
            for match in raw_matches:
                user_id = match['Face'].get('ExternalImageId', '')
                similarity = float(match.get('Similarity', 0))
                if user_id and (user_id not in best_by_user or similarity > best_by_user[user_id]):
                    best_by_user[user_id] = similarity

            # Store raw matched user_ids on the photo for late-joiner backfill
            raw_matched_user_ids = list(best_by_user.keys())

            # Step 4: Create match records for participants only
            now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
            match_count = 0
            for user_id, similarity in best_by_user.items():
                if user_id not in participant_ids:
                    continue
                match_id = str(uuid.uuid4())
                try:
                    table.put_item(
                        Item={
                            'PK': f'PHOTO#{photo_id}',
                            'SK': f'MATCH#{match_id}',
                            'GSI1PK': f'USER#{user_id}',
                            'GSI1SK': f'MATCH#{match_id}',
                            'match_id': match_id,
                            'user_id': user_id,
                            'photo_id': photo_id,
                            'event_id': event_id,
                            'confidence': Decimal(str(similarity)),
                            'is_confirmed': False,
                            'entity_type': 'FACE_MATCH',
                            'created_at': now,
                        },
                        # Idempotency guard: skip if this exact match already exists
                        ConditionExpression='attribute_not_exists(PK)',
                    )
                except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
                    print(f"  Duplicate match skipped for {user_id} on photo {photo_id}")
                    continue
                match_count += 1
                print(f"  Match: {user_id} ({similarity:.1f}%)")

            elapsed = time.perf_counter() - start_time

            # Step 5: Update photo record
            table.update_item(
                Key={'PK': f'EVENT#{event_id}', 'SK': f'PHOTO#{photo_id}'},
                UpdateExpression='SET is_processing = :done, faces_detected = :faces, '
                                 'match_count = :mc, raw_matched_user_ids = :raw',
                ExpressionAttributeValues={
                    ':done': False,
                    ':faces': faces_detected,
                    ':mc': match_count,
                    ':raw': raw_matched_user_ids,
                },
            )

            print(f"Done: {match_count} participant match(es) in {elapsed:.3f}s")
            results.append({
                'photo_id': photo_id,
                'faces_detected': faces_detected,
                'matches_found': match_count,
                'status': 'success',
            })

        except Exception as e:
            print(f"Error processing photo {photo_id}: {e}")
            # Don't raise — let other records process; failed messages go to DLQ
            results.append({
                'photo_id': photo_id,
                'error': str(e),
                'status': 'failed',
            })

    return {
        'statusCode': 200,
        'body': json.dumps({'processed': len(event['Records']), 'results': results}),
    }
