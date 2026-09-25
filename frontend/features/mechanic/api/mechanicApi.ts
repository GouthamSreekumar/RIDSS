/**
 * Mechanic Module API client & React Query hooks.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/axios";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ComponentItem {
  component_id: string;
  vehicle_id: string;
  component_name: string;
  status: string;
}

export interface VehicleHealthItem {
  vehicle_id: string;
  team_id: string;
  chassis: string;
  engine: string;
  status: string;
  health_status: "good" | "needs_attention" | "critical";
  critical_count: number;
  attention_count: number;
  total_components: number;
  current_driver_name?: string | null;
}

export interface VehicleComponentDetail {
  vehicle_id: string;
  team_id: string;
  chassis: string;
  engine: string;
  status: string;
  health_status: "good" | "needs_attention" | "critical";
  critical_components: string[];
  needs_attention_components: string[];
  components: ComponentItem[];
}

export interface MaintenanceItem {
  maintenance_id: string;
  vehicle_id: string;
  vehicle_chassis?: string | null;
  mechanic_id: string;
  mechanic_name?: string | null;
  maintenance_date: string;
  description?: string | null;
  status: "scheduled" | "in_progress" | "completed";
}

export interface MechanicDashboardSummary {
  total_vehicles: number;
  good_count: number;
  needs_attention_count: number;
  critical_count: number;
  upcoming_maintenance_count: number;
  upcoming_maintenance: MaintenanceItem[];
  recent_activity: Array<{
    log_id: string;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    details?: Record<string, any> | null;
    created_at: string;
  }>;
}

export interface MaintenanceCreatePayload {
  vehicle_id: string;
  mechanic_id?: string;
  maintenance_date: string;
  description?: string;
}

export interface MaintenanceUpdatePayload {
  status: "scheduled" | "in_progress" | "completed";
  component_id?: string;
  new_component_status?: string;
}

// ── API Fetchers ─────────────────────────────────────────────────────────────

export async function fetchMechanicDashboard(): Promise<MechanicDashboardSummary> {
  const { data } = await apiClient.get<MechanicDashboardSummary>("/api/v1/mechanic/dashboard");
  return data;
}

export async function fetchMechanicVehicles(): Promise<VehicleHealthItem[]> {
  const { data } = await apiClient.get<VehicleHealthItem[]>("/api/v1/mechanic/vehicles");
  return data;
}

export async function fetchVehicleComponents(vehicleId: string): Promise<VehicleComponentDetail> {
  const { data } = await apiClient.get<VehicleComponentDetail>(`/api/v1/mechanic/vehicles/${vehicleId}/components`);
  return data;
}

export async function createVehicleComponent(
  vehicleId: string,
  payload: { component_name: string; status: string }
): Promise<ComponentItem> {
  const { data } = await apiClient.post<ComponentItem>(`/api/v1/mechanic/vehicles/${vehicleId}/components`, payload);
  return data;
}

export async function updateComponentStatus(componentId: string, status: string): Promise<ComponentItem> {
  const { data } = await apiClient.patch<ComponentItem>(`/api/v1/mechanic/components/${componentId}/status`, { status });
  return data;
}

export async function scheduleMaintenance(payload: MaintenanceCreatePayload): Promise<MaintenanceItem> {
  const { data } = await apiClient.post<MaintenanceItem>("/api/v1/mechanic/maintenance", payload);
  return data;
}

export async function updateMaintenanceStatus(
  maintenanceId: string,
  payload: MaintenanceUpdatePayload
): Promise<MaintenanceItem> {
  const { data } = await apiClient.patch<MaintenanceItem>(`/api/v1/mechanic/maintenance/${maintenanceId}`, payload);
  return data;
}

export async function fetchMaintenanceHistory(vehicleId?: string): Promise<MaintenanceItem[]> {
  const { data } = await apiClient.get<MaintenanceItem[]>("/api/v1/mechanic/maintenance/history", {
    params: vehicleId ? { vehicle_id: vehicleId } : undefined,
  });
  return data;
}

// ── React Query Hooks ────────────────────────────────────────────────────────

export function useMechanicDashboard() {
  return useQuery({
    queryKey: ["mechanic-dashboard"],
    queryFn: fetchMechanicDashboard,
    refetchInterval: 15_000,
  });
}

export function useMechanicVehicles() {
  return useQuery({
    queryKey: ["mechanic-vehicles"],
    queryFn: fetchMechanicVehicles,
  });
}

export function useVehicleComponents(vehicleId: string) {
  return useQuery({
    queryKey: ["vehicle-components", vehicleId],
    queryFn: () => fetchVehicleComponents(vehicleId),
    enabled: Boolean(vehicleId),
  });
}

export function useCreateComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, payload }: { vehicleId: string; payload: { component_name: string; status: string } }) =>
      createVehicleComponent(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mechanic-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mechanic-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-components"] });
    },
  });
}

export function useUpdateComponentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ componentId, status }: { componentId: string; status: string }) =>
      updateComponentStatus(componentId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mechanic-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mechanic-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-components"] });
    },
  });
}

export function useScheduleMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scheduleMaintenance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mechanic-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-history"] });
    },
  });
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ maintenanceId, payload }: { maintenanceId: string; payload: MaintenanceUpdatePayload }) =>
      updateMaintenanceStatus(maintenanceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mechanic-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mechanic-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-components"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-history"] });
    },
  });
}

export function useMaintenanceHistory(vehicleId?: string) {
  return useQuery({
    queryKey: ["maintenance-history", vehicleId],
    queryFn: () => fetchMaintenanceHistory(vehicleId),
  });
}
