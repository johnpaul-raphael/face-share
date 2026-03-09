"""
AWS Rekognition Service for FaceShare

Handles face detection, indexing, and matching using AWS Rekognition.
"""

import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Optional

from app.core.config import settings


class RekognitionService:
    """
    Service for AWS Rekognition face recognition operations.

    Provides methods to:
    - Index faces (store in collection)
    - Search faces (find matches)
    - Detect faces (find faces in images)
    """

    def __init__(self, collection_id: str = None):
        """
        Initialize Rekognition service.

        Args:
            collection_id: Name of the Rekognition collection.
                           Defaults to settings.REKOGNITION_COLLECTION_ID.
        """
        self.client = boto3.client(
            'rekognition',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.collection_id = collection_id or settings.REKOGNITION_COLLECTION_ID
        # Ensure the collection exists at startup
        self.create_collection()
    
    def create_collection(self) -> bool:
        """Create a new face collection if it doesn't exist."""
        try:
            self.client.create_collection(CollectionId=self.collection_id)
            print(f"[OK] Created collection: {self.collection_id}")
            return True
        except ClientError as e:
            if 'ResourceAlreadyExistsException' in str(e):
                print(f"[INFO] Collection already exists: {self.collection_id}")
                return True
            print(f"[ERROR] Error creating collection: {e}")
            return False
    
    def _call_index_faces(self, image_param: dict, external_image_id: str) -> Optional[Dict]:
        """Call index_faces and parse the result."""
        response = self.client.index_faces(
            CollectionId=self.collection_id,
            Image=image_param,
            ExternalImageId=external_image_id,
            DetectionAttributes=['DEFAULT'],
            MaxFaces=1,
            QualityFilter='NONE',
        )
        face_records = response.get('FaceRecords', [])
        unindexed = response.get('UnindexedFaces', [])
        print(f"[rekognition] FaceRecords={len(face_records)} UnindexedFaces={len(unindexed)}")
        for uf in unindexed:
            print(f"  UnindexedFace reasons: {uf.get('Reasons', [])}")
        if face_records:
            face = face_records[0]['Face']
            print(f"[OK] Indexed face: {face['FaceId']} (confidence {face['Confidence']:.1f}%)")
            return {
                'face_id': face['FaceId'],
                'external_image_id': face['ExternalImageId'],
                'confidence': face['Confidence'],
            }
        return None

    def index_face(self, s3_bucket: str, s3_key: str,
                   external_image_id: str) -> Optional[Dict]:
        """
        Index a face from an S3 image into the Rekognition collection.

        Tries the S3 reference first; if Rekognition rejects the format
        (e.g. WebP, HEIC, AVIF), downloads and converts to JPEG then retries.

        Returns a dict with face_id / confidence, or None if no face detected.
        Raises RuntimeError on unrecoverable AWS errors.
        """
        try:
            return self._call_index_faces(
                {'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
                external_image_id,
            )
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            print(f"[ERROR] Rekognition error [{error_code}]: {error_msg}")
            if error_code == 'InvalidImageFormatException':
                raise RuntimeError(
                    "invalid_image_format"
                ) from e
            raise RuntimeError(f"Rekognition error: {error_code} - {error_msg}") from e
    
    def search_faces_by_image(self, s3_bucket: str, s3_key: str,
                              threshold: float = 90.0) -> List[Dict]:
        """
        Search for matching faces in an image.
        
        Args:
            s3_bucket: S3 bucket name
            s3_key: S3 object key (path to image)
            threshold: Minimum confidence score (0-100)
        
        Returns:
            List of matching faces with confidence scores
        """
        try:
            response = self.client.search_faces_by_image(
                CollectionId=self.collection_id,
                Image={
                    'S3Object': {
                        'Bucket': s3_bucket,
                        'Name': s3_key
                    }
                },
                FaceMatchThreshold=threshold,
                MaxFaces=10
            )
            
            matches = []
            for match in response.get('FaceMatches', []):
                face = match['Face']
                matches.append({
                    'face_id': face['FaceId'],
                    'external_image_id': face['ExternalImageId'],
                    'similarity': match['Similarity'],
                    'confidence': face['Confidence']
                })
            
            print(f"[OK] Found {len(matches)} face matches")
            return matches
            
        except ClientError as e:
            print(f"[ERROR] Error searching faces: {e}")
            return []
    
    def detect_faces(self, s3_bucket: str, s3_key: str) -> List[Dict]:
        """
        Detect all faces in an image (without searching collection).
        
        Args:
            s3_bucket: S3 bucket name
            s3_key: S3 object key
        
        Returns:
            List of detected faces with bounding boxes
        """
        try:
            response = self.client.detect_faces(
                Image={
                    'S3Object': {
                        'Bucket': s3_bucket,
                        'Name': s3_key
                    }
                },
                Attributes=['ALL']
            )
            
            faces = []
            for face_detail in response.get('FaceDetails', []):
                bbox = face_detail['BoundingBox']
                faces.append({
                    'confidence': face_detail['Confidence'],
                    'bounding_box': {
                        'left': bbox['Left'],
                        'top': bbox['Top'],
                        'width': bbox['Width'],
                        'height': bbox['Height']
                    },
                    'age_range': face_detail.get('AgeRange', {}),
                    'gender': face_detail.get('Gender', {}),
                    'emotions': face_detail.get('Emotions', [])
                })
            
            print(f"[OK] Detected {len(faces)} faces")
            return faces
            
        except ClientError as e:
            print(f"[ERROR] Error detecting faces: {e}")
            return []
    
    def delete_face(self, face_id: str) -> bool:
        """
        Delete a face from the collection.
        
        Args:
            face_id: Rekognition face ID
        
        Returns:
            True if successful
        """
        try:
            self.client.delete_faces(
                CollectionId=self.collection_id,
                FaceIds=[face_id]
            )
            print(f"[OK] Deleted face: {face_id}")
            return True
            
        except ClientError as e:
            print(f"[ERROR] Error deleting face: {e}")
            return False
    
    def list_faces(self, max_results: int = 100) -> List[Dict]:
        """
        List all faces in the collection.
        
        Args:
            max_results: Maximum number of faces to return
        
        Returns:
            List of faces in the collection
        """
        try:
            response = self.client.list_faces(
                CollectionId=self.collection_id,
                MaxResults=max_results
            )
            
            faces = []
            for face in response.get('Faces', []):
                faces.append({
                    'face_id': face['FaceId'],
                    'external_image_id': face['ExternalImageId'],
                    'confidence': face['Confidence']
                })
            
            print(f"[OK] Listed {len(faces)} faces")
            return faces
            
        except ClientError as e:
            print(f"[ERROR] Error listing faces: {e}")
            return []


# Singleton instance
rekognition_service = RekognitionService()
