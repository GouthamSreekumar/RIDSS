/**
 * Axios instance configured for RIDSS API.
 *
 * Key decisions:
 * - withCredentials: true  → cookies (JWT + CSRF) auto-attach to every request
 * - Request interceptor    → reads the non-httpOnly ridss_csrf_token cookie
 *                            and injects it as X-CSRF-Token on mutating methods
 * - Response interceptor   → on 401, redirect to /login (expired session)
 *
 * Judgment call: We read the CSRF cookie with a regex over document.cookie
 * rather than a third-party cookie library to keep the bundle lean and avoid
 * supply-chain risk on a security-critical path.
 *
 * Never log request/response bodies — they may contain credentials.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

function readCsrfCookie(): string {
  if (typeof document === "undefined") return ""; // SSR guard
  const match = document.cookie.match(/(?:^|;\s*)ridss_csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

const apiClient = axios.create({
  baseURL: typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") // SSR: call backend directly
    : "",  // Browser: use relative paths → Next.js rewrites /api/* to backend
  withCredentials: true, // essential — sends httpOnly JWT + CSRF cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach CSRF token ────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = config.method?.toLowerCase() ?? "";
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfCookie();
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

// ── Response interceptor: handle expired sessions ────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      // Session expired — redirect to login without leaking current URL as a
      // query param (avoids open redirect risks on the login page).
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
