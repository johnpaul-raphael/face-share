import { User } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ─── Upload quality (server-controlled via SSM) ──────────────────────────────

export type ImageQuality = 'optimized' | 'original';

// ─── File validation ─────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_EVENT_PHOTO_MB = 30;
const MAX_FACE_PHOTO_MB = 15;

/** Returns an error message string, or null if the file is valid. */
export function validateImageFile(file: File, context: 'event' | 'face' | 'cover' = 'event'): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return 'Unsupported file type. Please use JPEG, PNG, WebP, or HEIC.';
  }
  const maxMB = context === 'face' ? MAX_FACE_PHOTO_MB : MAX_EVENT_PHOTO_MB;
  if (file.size > maxMB * 1024 * 1024) {
    return `File too large. Maximum size is ${maxMB} MB.`;
  }
  return null;
}

/**
 * Resize + compress an image using the Canvas API before upload.
 * Reduces file size significantly (e.g. 10 MB → ~400 KB) while keeping
 * enough resolution for Rekognition face detection.
 * Falls back to the original file if compression fails or runs outside a browser context.
 */
export async function compressImage(
  file: File,
  maxDimension: number,
  quality: number,
): Promise<File> {
  if (typeof window === 'undefined') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Replace extension with .jpg since we always output JPEG
          const name = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

export interface ApiError {
  detail: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || 'An error occurred');
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async googleLogin(idToken: string) {
    const result = await this.request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: idToken }) });

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);
    }
    return result;
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  async getCurrentUser(): Promise<User> {
    const raw = await this.request<{ id: string; email: string; name: string; avatar_url?: string }>('/auth/me');
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      ...(raw.avatar_url != null && { avatarUrl: raw.avatar_url }),
    };
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const raw = await this.request<{ id: string; email: string; name: string; avatar_url?: string }>(
      '/users/me',
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          ...(data.avatarUrl != null && { avatar_url: data.avatarUrl }),
        }),
      },
    );
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      ...(raw.avatar_url != null && { avatarUrl: raw.avatar_url }),
    };
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  async createEvent(data: { name: string; description?: string; cover_image_url?: string }) {
    return this.request<EventResponse>('/events', { method: 'POST', body: JSON.stringify(data) });
  }

  async listEvents(): Promise<EventResponse[]> {
    return this.request<EventResponse[]>('/events');
  }

  async getEvent(eventId: string): Promise<EventDetailResponse> {
    return this.request<EventDetailResponse>(`/events/${eventId}`);
  }

  async updateEvent(eventId: string, data: { name?: string; description?: string; cover_image_url?: string }) {
    return this.request<EventResponse>(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteEvent(eventId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}`, { method: 'DELETE' });
  }

  async joinEvent(joinCode: string) {
    return this.request<{ event: EventResponse; status: string }>('/events/join', {
      method: 'POST',
      body: JSON.stringify({ join_code: joinCode }),
    });
  }

  // ─── Participants ──────────────────────────────────────────────────────────

  async listParticipants(eventId: string): Promise<ParticipantResponse[]> {
    return this.request<ParticipantResponse[]>(`/events/${eventId}/participants`);
  }

  async approveParticipant(eventId: string, userId: string) {
    return this.request<ParticipantResponse>(`/events/${eventId}/participants/${userId}/approve`, { method: 'PATCH' });
  }

  async removeParticipant(eventId: string, userId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}/participants/${userId}`, { method: 'DELETE' });
  }

  async leaveEvent(eventId: string, userId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}/participants/${userId}`, { method: 'DELETE' });
  }

  async setUploadPermission(eventId: string, userId: string, grant: boolean): Promise<ParticipantResponse> {
    return this.request<ParticipantResponse>(
      `/events/${eventId}/participants/${userId}/upload-permission?grant=${grant}`,
      { method: 'PATCH' },
    );
  }

  // ─── Images / Photos ───────────────────────────────────────────────────────

  async getPresignedUpload(data: {
    filename: string;
    content_type?: string;
    file_size?: number;
    event_id?: string;
    user_id?: string;
    face_image_id?: string;
  }) {
    return this.request<PresignedUploadResponse>('/images/presigned-upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadToS3(uploadUrl: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
    console.log('[S3 Upload] Starting PUT', {
      endpoint: uploadUrl.split('?')[0],
      fileType: file.type,
      fileSize: file.size,
    });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      // Content-Type is intentionally NOT included in the presigned URL signature,
      // so we don't set it here to avoid any header-signature mismatch on S3's side.
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[S3 Upload] Success', xhr.status);
          resolve();
        } else {
          // Log full S3 error XML for debugging
          console.error('[S3 Upload] FAILED', xhr.status, xhr.responseText);
          // Parse S3 XML error code if present
          const codeMatch = xhr.responseText.match(/<Code>([^<]+)<\/Code>/);
          const msgMatch  = xhr.responseText.match(/<Message>([^<]+)<\/Message>/);
          const code = codeMatch ? codeMatch[1] : xhr.status.toString();
          const msg  = msgMatch  ? msgMatch[1]  : '';
          reject(new Error(`S3 upload failed: ${code}${msg ? ` — ${msg}` : ''}`));
        }
      };
      xhr.onerror = () => reject(new Error('S3 upload network error'));
      xhr.send(file);
    });
  }

  async confirmFaceProfileUpload(faceImageId: string, s3Key: string, description?: string) {
    const params = new URLSearchParams({ face_image_id: faceImageId, s3_key: s3Key });
    if (description) params.set('description', description);
    return this.request<FaceProfileImageResponse>(`/images/face-profile/confirm-upload?${params}`, { method: 'POST' });
  }

  async getPresignedDownload(s3Key: string) {
    return this.request<{ download_url: string; expires_in: number }>('/images/presigned-download', {
      method: 'POST',
      body: JSON.stringify({ s3_key: s3Key }),
    });
  }

  async getEventPhotos(eventId: string): Promise<PhotoResponse[]> {
    return this.request<PhotoResponse[]>(`/events/${eventId}/photos`);
  }

  async processPhoto(eventId: string, photoId: string): Promise<{ processed: boolean; matches_found: number }> {
    return this.request(`/events/${eventId}/photos/${photoId}/process`, { method: 'POST' });
  }

  async deletePhoto(eventId: string, photoId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}/photos/${photoId}`, { method: 'DELETE' });
  }

  async getPhotoMatches(eventId: string, photoId: string): Promise<FaceMatchResponse[]> {
    return this.request<FaceMatchResponse[]>(`/events/${eventId}/photos/${photoId}/matches`);
  }

  async confirmMatch(eventId: string, photoId: string, matchId: string) {
    return this.request<{ status: string; match_id: string }>(
      `/events/${eventId}/photos/${photoId}/matches/${matchId}/confirm`,
      { method: 'PATCH' },
    );
  }

  async deleteMatch(eventId: string, photoId: string, matchId: string): Promise<void> {
    return this.request<void>(`/events/${eventId}/photos/${photoId}/matches/${matchId}`, { method: 'DELETE' });
  }

  // ─── Face Profile ──────────────────────────────────────────────────────────

  async getFaceProfile() {
    return this.request<FaceProfileResponse>('/users/me/face-profile');
  }

  async deleteFaceProfileImage(imageId: string): Promise<void> {
    return this.request<void>(`/users/me/face-profile/${imageId}`, { method: 'DELETE' });
  }

  // ─── My Photos ─────────────────────────────────────────────────────────────

  async getMyPhotos(): Promise<MyPhotosGroup[]> {
    return this.request<MyPhotosGroup[]>('/users/me/photos');
  }

  // ─── App config (server-controlled) ────────────────────────────────────────

  async getAppConfig(): Promise<{ image_quality: ImageQuality }> {
    return this.request<{ image_quality: ImageQuality }>('/config');
  }
}

export const apiClient = new ApiClient();

// ─── Response types ─────────────────────────────────────────────────────────

export interface EventResponse {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_name: string;
  cover_image_url?: string;
  cover_photo_s3_key?: string;
  join_code: string;
  created_at: string;
  updated_at?: string;
  participant_count: number;
}

export interface ParticipantResponse {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar_url?: string;
  status: 'pending' | 'approved';
  joined_at?: string;
  can_upload: boolean;
}

export interface EventDetailResponse extends EventResponse {
  participants: ParticipantResponse[];
}

export interface PresignedUploadResponse {
  upload_url: string;
  s3_key: string;
  expires_in: number;
  photo_id?: string;
  face_image_id?: string;
}

export interface PhotoResponse {
  photo_id: string;
  event_id: string;
  uploader_id: string;
  s3_key: string;
  url?: string;
  thumbnail_url?: string;
  is_processing: boolean;
  uploaded_at?: string;
  match_count: number;
}

export interface FaceProfileImageResponse {
  id: string;
  s3_key: string;
  url?: string;
  description?: string;
  created_at?: string;
}

export interface FaceProfileResponse {
  user_id: string;
  images: FaceProfileImageResponse[];
  image_count: number;
  is_complete: boolean;
}

export interface FaceMatchResponse {
  match_id: string;
  photo_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  confidence: number;
  is_confirmed: boolean;
  created_at?: string;
}

export interface MyPhotoEntry {
  photo_id: string;
  event_id: string;
  url?: string;
  s3_key: string;
  uploaded_at: string;
  is_processing: boolean;
  confidence: number;
  is_confirmed: boolean;
  match_id: string;
}

export interface MyPhotosGroup {
  event_id: string;
  event_name: string;
  photos: MyPhotoEntry[];
}
