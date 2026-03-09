import { User } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
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
