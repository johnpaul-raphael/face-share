export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export type Event = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  participantIds: string[];
  coverImageUrl: string;
  joinCode: string;
  newPhotosCount?: number;
};

export type Photo = {
  id: string;
  eventId: string;
  uploaderId: string;
  url: string;
  uploadedAt: string;
  matches: FaceMatch[];
  isProcessing?: boolean;
};

export type FaceMatch = {
  photoId: string;
  userId: string | null;
  confidence: number;
  isConfirmed: boolean;
  faceImageUrl?: string; // Cropped face image
};
