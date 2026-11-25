import axios from 'axios';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  return config;
});

export function extractErrorMessage(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
    if (err.message) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
