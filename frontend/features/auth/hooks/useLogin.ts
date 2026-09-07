/**
 * useLogin — React Query mutation for authenticating a user.
 *
 * Behavior:
 * 1. Calls POST /api/v1/auth/login
 * 2. On success: invalidates /me cache → routes to role-specific dashboard
 * 3. On 401: returns generic "Invalid email or password"
 * 4. On 429: extracts retry_after and returns a cooldown message
 * 5. On any other error: returns a safe generic message
 *
 * Judgment call: We do NOT log error details to console — the error object
 * from Axios may contain request config including the request body.
 * Error messages are derived from response.data.detail only.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";

import { loginUser } from "../api/authApi";
import type { LoginPayload, LoginResponse } from "../schemas/loginSchema";
import { getRouteForRole } from "../schemas/loginSchema";


interface LoginError {
  message: string;
  /** Seconds until the rate-limit lifts. Present only on 429. */
  retryAfter?: number;
}

interface UseLoginReturn {
  mutate: (credentials: LoginPayload) => void;
  isPending: boolean;
  error: LoginError | null;
  isSuccess: boolean;
}

export function useLogin(): UseLoginReturn {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation<LoginResponse, AxiosError, LoginPayload>({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Invalidate any stale /me query so role checks are fresh
      queryClient.invalidateQueries({ queryKey: ["me"] });

      const route = getRouteForRole(data.role);
      // router.push for a client-side redirect — no full page reload
      router.push(route);

    },
    // onError intentionally omitted — error is read via mutation.error below
    // to avoid stale closure issues if the component re-renders.
  });

  const error: LoginError | null = mutation.error
    ? parseError(mutation.error)
    : null;

  return {
    mutate: mutation.mutate,
    isPending: mutation.isPending,
    error,
    isSuccess: mutation.isSuccess,
  };
}

function parseError(err: AxiosError): LoginError {
  const status = err.response?.status;
  const data = err.response?.data as Record<string, unknown> | undefined;

  if (status === 429) {
    const retryAfter = Number(
      err.response?.headers?.["retry-after"] ?? data?.["retry_after"] ?? 60
    );
    return {
      message: `Too many failed attempts. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
    };
  }

  if (status === 401 || status === 403) {
    return { message: "Invalid email or password." };
  }

  // Preserve backend detail message for non-auth errors (e.g. 422 validation)
  // but fall back to a safe generic string — never expose raw error objects.
  const detail = typeof data?.["detail"] === "string" ? data["detail"] : null;
  return { message: detail ?? "An unexpected error occurred. Please try again." };
}
