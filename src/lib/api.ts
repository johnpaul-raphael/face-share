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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || 'An error occurred');
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: { email: string; password: string; name: string }) {
    const result = await this.request<{ id: string; email: string; name: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return result;
  }

  async login(data: { email: string; password: string }) {
    const result = await this.request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // Store tokens
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);
    }
    
    return result;
  }

  async getCurrentUser(): Promise<User> {
    const raw = await this.request<{ id: string; email: string; name: string; avatar_url?: string }>(
      '/auth/me'
    );
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      ...(raw.avatar_url != null && { avatarUrl: raw.avatar_url }),
    };
  }

  async updateProfile(data: User): Promise<User> {
    const raw = await this.request<{ id: string; email: string; name: string; avatar_url?: string }>(
      '/users/me',
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          ...(data.avatarUrl != null && { avatar_url: data.avatarUrl }),
        }),
      }
    );
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      ...(raw.avatar_url != null && { avatarUrl: raw.avatar_url }),
    };
  }
}

export const apiClient = new ApiClient();
