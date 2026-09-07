/**
 * Auth API layer — all calls to FastAPI auth endpoints.
 * withCredentials is set globally on the apiClient instance.
 */
import apiClient from "@/lib/axios";
import type { LoginPayload, LoginResponse, UserMeResponse } from "../schemas/loginSchema";

/** POST /api/v1/auth/login */
export async function loginUser(credentials: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/v1/auth/login", credentials);
  return data;
}

/** POST /api/v1/auth/logout */
export async function logoutUser(): Promise<void> {
  await apiClient.post("/api/v1/auth/logout");
}

/** GET /api/v1/auth/me — returns current user from cookie JWT */
export async function fetchMe(): Promise<UserMeResponse> {
  const { data } = await apiClient.get<UserMeResponse>("/api/v1/auth/me");
  return data;
}

/** GET /api/v1/auth/csrf-token — bootstraps CSRF token cookie before form mount */
export async function fetchCsrfToken(): Promise<string> {
  const { data } = await apiClient.get<{ csrf_token: string }>("/api/v1/auth/csrf-token");
  return data.csrf_token;
}
