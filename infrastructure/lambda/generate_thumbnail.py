# infrastructure/lambda/generate_thumbnail.py
"""
Lambda function triggered by S3 ObjectCreated on the 'events/' prefix.
Downloads the original event photo, resizes it to 400px wide (preserving
aspect ratio), and saves the result under the 'thumbs/' prefix.

Key mapping:
  Original:  events/{event_id}/photos/{photo_id}/{filename}
  Thumbnail: thumbs/events/{event_id}/photos/{photo_id}/{filename}

The 'thumbs/' prefix is deliberately outside the 'events/' S3 trigger
prefix so this Lambda never triggers itself in an infinite loop.

After saving the thumbnail, it writes thumbnail_s3_key back to the
photo's DynamoDB record so the API can serve a presigned URL for it.
"""

import io
import os
import urllib.parse
import boto3
from PIL import Image

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('AWS_DYNAMODB_TABLE_NAME', 'FaceShareData')
THUMBNAIL_WIDTH = 400


def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)

    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        original_key = urllib.parse.unquote_plus(
            record['s3']['object']['key'], encoding='utf-8'
        )

        # Safety guard: skip if this is somehow a thumbnail (shouldn't happen
        # given the trigger prefix, but belt-and-suspenders)
        if original_key.startswith('thumbs/'):
            print(f"Skipping already-thumbnail key: {original_key}")
            continue

        # Parse event_id and photo_id from the key
        # Expected format: events/{event_id}/photos/{photo_id}/{filename}
        parts = original_key.split('/')
        if len(parts) < 5 or parts[0] != 'events' or parts[2] != 'photos':
            print(f"Skipping non-photo key: {original_key}")
            continue

        event_id = parts[1]
        photo_id = parts[3]
        thumbnail_key = f"thumbs/{original_key}"

        print(f"Generating thumbnail for photo {photo_id} (event {event_id})")

        try:
            # Download original from S3
            response = s3.get_object(Bucket=bucket, Key=original_key)
            image_data = response['Body'].read()

            # Resize with Pillow — maintain aspect ratio, width = THUMBNAIL_WIDTH
            with Image.open(io.BytesIO(image_data)) as img:
                img = img.convert('RGB')  # Normalise RGBA/palette PNGs → JPEG-safe
                original_width, original_height = img.size
                new_height = int(original_height * THUMBNAIL_WIDTH / original_width)
                img = img.resize((THUMBNAIL_WIDTH, new_height), Image.LANCZOS)

                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=85, optimize=True)
                buffer.seek(0)

            # Upload thumbnail to S3
            s3.put_object(
                Bucket=bucket,
                Key=thumbnail_key,
                Body=buffer,
                ContentType='image/jpeg',
            )
            print(f"Thumbnail saved: {thumbnail_key}")

            # Write thumbnail_s3_key to DynamoDB so the API can serve it
            table.update_item(
                Key={
                    'PK': f'EVENT#{event_id}',
                    'SK': f'PHOTO#{photo_id}',
                },
                UpdateExpression='SET #thumb = :thumb',
                ExpressionAttributeNames={'#thumb': 'thumbnail_s3_key'},
                ExpressionAttributeValues={':thumb': thumbnail_key},
            )
            print(f"DynamoDB updated for photo {photo_id}")

        except Exception as e:
            # Log but don't re-raise — a thumbnail failure should never block
            # the main photo pipeline. The gallery will fall back to full-res.
            print(f"ERROR generating thumbnail for {original_key}: {e}")

    return {'statusCode': 200}
