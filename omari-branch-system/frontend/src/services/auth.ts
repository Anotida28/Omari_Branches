import { api } from "./api";
import type { ApiDataResponse, AuthLoginApiResponse, AuthUser } from "../types/api";

export type LoginPayload = {
  username: string;
  password: string;
};

export async function login(payload: LoginPayload): Promise<AuthLoginApiResponse> {
  const { data } = await api.post<AuthLoginApiResponse>(
    "/api/auth/login",
    payload,
  );
  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<ApiDataResponse<AuthUser>>("/api/auth/me");
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}
