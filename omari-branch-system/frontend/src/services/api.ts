import axios from "axios";

export const AUTH_TOKEN_STORAGE_KEY = "omari_branch_system_auth_token";
export const API_UNAUTHORIZED_EVENT = "omari:unauthorized";

export function getStoredAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = token.trim();
  if (!normalized) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearStoredAuthToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
      }
    }

    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { error?: string; details?: unknown }
      | undefined;
    if (payload?.error && typeof payload.error === "string") {
      return payload.error;
    }

    if (typeof payload?.details === "string") {
      return payload.details;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
}
