/**
 * Team Manager API client & React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/axios";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriverSummary {
  driver_id: string;
  user_id: string;
  driver_number: number;
  full_name: string;
  nationality?: string | null;
}

export interface VehicleSummary {
  vehicle_id: string;
  chassis: string;
  engine: string;
  status: string;
}

export interface DriverVehicleAssignment {
  assignment_id: string;
  team_id: string;
  driver_id: string;
  vehicle_id: string;
  status: string;
  assigned_at: string;
  season?: number | null;
  driver?: DriverSummary | null;
  vehicle?: VehicleSummary | null;
}

export interface TeamDriverItem {
  driver_id: string;
  user_id: string;
  driver_number: number;
  nationality?: string | null;
  full_name: string;
  email: string;
  current_vehicle?: VehicleSummary | null;
  current_assignment_id?: string | null;
}

export interface TeamVehicleItem {
  vehicle_id: string;
  team_id: string;
  chassis: string;
  engine: string;
  status: string;
  current_driver?: DriverSummary | null;
  current_assignment_id?: string | null;
}

export interface RecentActivityItem {
  log_id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  created_at: string;
}

export interface TeamDashboardSummary {
  team_id: string;
  team_name: string;
  driver_count: number;
  vehicle_count: number;
  active_pairings_count: number;
  unassigned_drivers_count: number;
  unassigned_vehicles_count: number;
  recent_activity: RecentActivityItem[];
}

export interface TeamReport {
  report_id: string;
  team_id?: string | null;
  generated_by: string;
  generator_name?: string | null;
  report_type: string;
  created_at: string;
  data?: {
    generated_at: string;
    team_id: string;
    team_name: string;
    summary: {
      total_drivers: number;
      total_vehicles: number;
      active_pairings: number;
    };
    drivers: Array<{
      driver_id: string;
      driver_number: number;
      full_name: string;
      email: string;
      nationality?: string | null;
    }>;
    vehicles: Array<{
      vehicle_id: string;
      chassis: string;
      engine: string;
      status: string;
    }>;
    pairings: Array<{
      assignment_id: string;
      driver_number?: number | null;
      driver_name?: string | null;
      vehicle_chassis?: string | null;
      vehicle_engine?: string | null;
      season?: number | null;
      assigned_at: string;
    }>;
  } | null;
}

export interface AssignmentCreatePayload {
  driver_id: string;
  vehicle_id: string;
  season?: number;
}

// ── API Fetchers ─────────────────────────────────────────────────────────────

export async function fetchTeamDashboard(): Promise<TeamDashboardSummary> {
  const { data } = await apiClient.get<TeamDashboardSummary>("/api/v1/team-manager/dashboard");
  return data;
}

export async function fetchTeamDrivers(): Promise<TeamDriverItem[]> {
  const { data } = await apiClient.get<TeamDriverItem[]>("/api/v1/team-manager/drivers");
  return data;
}

export async function fetchTeamVehicles(): Promise<TeamVehicleItem[]> {
  const { data } = await apiClient.get<TeamVehicleItem[]>("/api/v1/team-manager/vehicles");
  return data;
}

export async function fetchTeamAssignments(includeHistory = false): Promise<DriverVehicleAssignment[]> {
  const { data } = await apiClient.get<DriverVehicleAssignment[]>("/api/v1/team-manager/assignments", {
    params: { include_history: includeHistory },
  });
  return data;
}

export async function assignDriverToVehicle(payload: AssignmentCreatePayload): Promise<DriverVehicleAssignment> {
  const { data } = await apiClient.post<DriverVehicleAssignment>("/api/v1/team-manager/assignments", payload);
  return data;
}

export async function unassignDriver(assignmentId: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/api/v1/team-manager/assignments/${assignmentId}`);
  return data;
}

export async function generateTeamReport(): Promise<TeamReport> {
  const { data } = await apiClient.post<TeamReport>("/api/v1/team-manager/reports");
  return data;
}

export async function fetchTeamReports(): Promise<TeamReport[]> {
  const { data } = await apiClient.get<TeamReport[]>("/api/v1/team-manager/reports");
  return data;
}

// ── React Query Hooks ────────────────────────────────────────────────────────

export function useTeamDashboard() {
  return useQuery({
    queryKey: ["team-manager-dashboard"],
    queryFn: fetchTeamDashboard,
    refetchInterval: 15_000,
  });
}

export function useTeamDrivers() {
  return useQuery({
    queryKey: ["team-manager-drivers"],
    queryFn: fetchTeamDrivers,
  });
}

export function useTeamVehicles() {
  return useQuery({
    queryKey: ["team-manager-vehicles"],
    queryFn: fetchTeamVehicles,
  });
}

export function useTeamAssignments(includeHistory = false) {
  return useQuery({
    queryKey: ["team-manager-assignments", includeHistory],
    queryFn: () => fetchTeamAssignments(includeHistory),
  });
}

export function useAssignDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignDriverToVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-manager-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-assignments"] });
    },
  });
}

export function useUnassignDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unassignDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-manager-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-assignments"] });
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateTeamReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-manager-reports"] });
      queryClient.invalidateQueries({ queryKey: ["team-manager-dashboard"] });
    },
  });
}

export function useTeamReports() {
  return useQuery({
    queryKey: ["team-manager-reports"],
    queryFn: fetchTeamReports,
  });
}
