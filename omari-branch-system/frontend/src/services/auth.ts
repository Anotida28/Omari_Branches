import { api } from "./api";
import type { ApiDataResponse, AuthUser, LoginResponse } from "../types/api";

type LoginPayload = {
  username: string;
  password: string;
};

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<ApiDataResponse<LoginResponse>>(
    "/api/auth/login",
    payload,
  );
  return data.data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<ApiDataResponse<AuthUser>>("/api/auth/me");
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}
