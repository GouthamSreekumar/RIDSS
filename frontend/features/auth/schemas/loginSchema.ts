/**
 * Zod schema and TypeScript types for login form and API contract.
 *
 * Judgment call: Password validation here is intentionally minimal —
 * only "required". Adding length/complexity rules would leak password policy
 * to potential attackers probing the login page. The backend validates
 * against the stored hash and returns a generic error on any mismatch.
 */
import { z } from "zod";

// ── Request schema ────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginPayload = z.infer<typeof loginSchema>;

// ── Response types ────────────────────────────────────────────────────────────

/** Matches the TokenResponse Pydantic schema from FastAPI. */
export interface LoginResponse {
  role: string;
  user_id: string;
  email: string;
  full_name: string;
}

/** Matches the UserMeResponse Pydantic schema. */
export interface UserMeResponse {
  user_id: string;
  email: string;
  role: string;
  full_name: string;
}

/** Role → frontend route mapping — matches both DB names and normalized enum names. */
export const ROLE_ROUTES: Record<string, string> = {
  administrator: "/admin",
  Administrator: "/admin",
  team_manager: "/team-manager",
  "Team Manager": "/team-manager",
  race_engineer: "/race-engineer",
  "Race Engineer": "/race-engineer",
  strategy_engineer: "/strategy-engineer",
  "Strategy Engineer": "/strategy-engineer",
  mechanic: "/mechanic",
  Mechanic: "/mechanic",
  driver: "/driver",
  Driver: "/driver",
};

export function getRouteForRole(role: string | null | undefined): string {
  if (!role) return "/admin";
  if (ROLE_ROUTES[role]) return ROLE_ROUTES[role];
  const normalized = role.toLowerCase().trim().replace(/[\s_]+/g, "_");
  return ROLE_ROUTES[normalized] || "/admin";
}

