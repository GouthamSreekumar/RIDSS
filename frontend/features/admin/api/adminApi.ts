/**
 * Admin module API layer.
 * All calls use the shared apiClient (withCredentials + CSRF interceptor).
 */
import apiClient from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminDashboardData {
  user_count: number;
  team_count: number;
  active_races_count: number;
  recent_activity: AuditLog[];
  system_health: Record<string, string>;
}

export interface UserRole { role_id: string; role_name: string; }
export interface UserTeam { team_id: string; team_name: string; }
export interface User {
  user_id: string; full_name: string; email: string;
  role_id: string; team_id: string | null; status: string;
  created_at: string; role?: UserRole; team?: UserTeam;
}
export interface UserCreate {
  full_name: string; email: string; password: string;
  role_id: string; team_id?: string;
}
export interface UserUpdate {
  full_name?: string; email?: string; role_id?: string;
  team_id?: string; status?: string;
}

export interface Team {
  team_id: string; team_name: string;
  principal: string | null; headquarters: string | null;
}
export interface TeamDetail extends Team { members: User[]; }
export interface TeamCreate { team_name: string; principal?: string; headquarters?: string; }
export interface TeamUpdate { team_name?: string; principal?: string; headquarters?: string; }

export interface Role { role_id: string; role_name: string; description?: string; }
export interface Permission {
  permission_id: string; permission_key: string;
  description?: string; module: string;
}
export interface ModulePermissions { module: string; permissions: Permission[]; }
export interface RoleMatrixEntry {
  role_id: string; role_name: string; description?: string;
  permission_ids: string[]; permission_keys: string[];
}
export interface RoleMatrix { roles: RoleMatrixEntry[]; modules: Record<string, Permission[]>; }

export interface Circuit {
  circuit_id: string; circuit_name: string; country: string; length: number;
}
export interface Race {
  race_id: string; race_name: string; circuit_id: string;
  race_date: string; season: number; circuit?: Circuit;
}
export interface RaceCreate { race_name: string; circuit_id: string; race_date: string; season: number; }
export interface CircuitCreate { circuit_name: string; country: string; length: number; }

export interface Notification {
  notification_id: string; user_id: string; title: string;
  message: string; status: string; created_at: string;
}
export interface NotificationCreate { user_ids: string[]; title: string; message: string; }

export interface AuditLog {
  log_id: string; user_id?: string; action: string; entity_type: string;
  entity_id?: string; details?: string; ip_address?: string;
  created_at: string; user_email?: string;
}

export interface SystemSetting {
  setting_id: string; category: string; key: string; value: string;
  updated_by?: string; updated_at: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const fetchDashboard = async (): Promise<AdminDashboardData> => {
  const { data } = await apiClient.get<AdminDashboardData>("/api/v1/admin/dashboard");
  return data;
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const fetchUsers = async (params?: {
  query?: string; role_id?: string; team_id?: string; status?: string;
}): Promise<User[]> => {
  const { data } = await apiClient.get<User[]>("/api/v1/users", { params });
  return data;
};

export const fetchUser = async (userId: string): Promise<User> => {
  const { data } = await apiClient.get<User>(`/api/v1/users/${userId}`);
  return data;
};

export const createUser = async (payload: UserCreate): Promise<User> => {
  const { data } = await apiClient.post<User>("/api/v1/users", payload);
  return data;
};

export const updateUser = async (userId: string, payload: UserUpdate): Promise<User> => {
  const { data } = await apiClient.put<User>(`/api/v1/users/${userId}`, payload);
  return data;
};

export const toggleUserStatus = async (userId: string, status: "active" | "disabled"): Promise<User> => {
  const { data } = await apiClient.patch<User>(`/api/v1/users/${userId}/status`, { status });
  return data;
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const fetchTeams = async (): Promise<Team[]> => {
  const { data } = await apiClient.get<Team[]>("/api/v1/teams");
  return data;
};

export const fetchTeamDetail = async (teamId: string): Promise<TeamDetail> => {
  const { data } = await apiClient.get<TeamDetail>(`/api/v1/teams/${teamId}`);
  return data;
};

export const createTeam = async (payload: TeamCreate): Promise<Team> => {
  const { data } = await apiClient.post<Team>("/api/v1/teams", payload);
  return data;
};

export const updateTeam = async (teamId: string, payload: TeamUpdate): Promise<Team> => {
  const { data } = await apiClient.put<Team>(`/api/v1/teams/${teamId}`, payload);
  return data;
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/teams/${teamId}`);
};

export const assignTeamMember = async (teamId: string, userId: string): Promise<TeamDetail> => {
  const { data } = await apiClient.post<TeamDetail>(`/api/v1/teams/${teamId}/members`, { user_id: userId });
  return data;
};

export const removeTeamMember = async (teamId: string, userId: string): Promise<TeamDetail> => {
  const { data } = await apiClient.delete<TeamDetail>(`/api/v1/teams/${teamId}/members/${userId}`);
  return data;
};

// ── Roles & Permissions ───────────────────────────────────────────────────────

export const fetchRoles = async (): Promise<Role[]> => {
  const { data } = await apiClient.get<Role[]>("/api/v1/roles");
  return data;
};

export const fetchRoleMatrix = async (): Promise<RoleMatrix> => {
  const { data } = await apiClient.get<RoleMatrix>("/api/v1/roles/matrix");
  return data;
};

export const createRole = async (payload: { role_name: string; description?: string }): Promise<Role> => {
  const { data } = await apiClient.post<Role>("/api/v1/roles", payload);
  return data;
};

export const updateRolePermissions = async (roleId: string, permissionIds: string[]): Promise<void> => {
  await apiClient.put(`/api/v1/roles/${roleId}/permissions`, { permission_ids: permissionIds });
};

export const fetchAllPermissions = async (): Promise<ModulePermissions[]> => {
  const { data } = await apiClient.get<ModulePermissions[]>("/api/v1/permissions");
  return data;
};

// ── Races & Circuits ──────────────────────────────────────────────────────────

export const fetchRaces = async (): Promise<Race[]> => {
  const { data } = await apiClient.get<Race[]>("/api/v1/races");
  return data;
};

export const createRace = async (payload: RaceCreate): Promise<Race> => {
  const { data } = await apiClient.post<Race>("/api/v1/races", payload);
  return data;
};

export const updateRace = async (raceId: string, payload: Partial<RaceCreate>): Promise<Race> => {
  const { data } = await apiClient.put<Race>(`/api/v1/races/${raceId}`, payload);
  return data;
};

export const deleteRace = async (raceId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/races/${raceId}`);
};

export const fetchCircuits = async (): Promise<Circuit[]> => {
  const { data } = await apiClient.get<Circuit[]>("/api/v1/circuits");
  return data;
};

export const createCircuit = async (payload: CircuitCreate): Promise<Circuit> => {
  const { data } = await apiClient.post<Circuit>("/api/v1/circuits", payload);
  return data;
};

export const deleteCircuit = async (circuitId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/circuits/${circuitId}`);
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const fetchNotifications = async (): Promise<Notification[]> => {
  const { data } = await apiClient.get<Notification[]>("/api/v1/notifications");
  return data;
};

export const sendNotification = async (payload: NotificationCreate): Promise<Notification[]> => {
  const { data } = await apiClient.post<Notification[]>("/api/v1/notifications", payload);
  return data;
};

export const archiveNotification = async (notifId: string): Promise<void> => {
  await apiClient.patch(`/api/v1/notifications/${notifId}/status`, { status: "archived" });
};

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const fetchAuditLogs = async (params?: {
  action?: string; entity_type?: string; skip?: number; limit?: number;
}): Promise<AuditLog[]> => {
  const { data } = await apiClient.get<AuditLog[]>("/api/v1/audit-logs", { params });
  return data;
};

// ── System Settings ───────────────────────────────────────────────────────────

export const fetchSettings = async (): Promise<SystemSetting[]> => {
  const { data } = await apiClient.get<SystemSetting[]>("/api/v1/settings");
  return data;
};

export const updateSettings = async (settings: Record<string, string>): Promise<SystemSetting[]> => {
  const { data } = await apiClient.put<SystemSetting[]>("/api/v1/settings", { settings });
  return data;
};
