"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,

  Clock,
  Eye,
  Globe,
  Laptop,
  Plus,
  Search,
  Shield,
  UserX,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  bulkUpdateUserStatus,
  createUser,
  fetchRoles,
  fetchTeams,
  fetchUserLoginHistory,
  fetchUsers,
  toggleUserStatus,
  type User,
  type UserCreate,
  type LoginHistoryItem,
} from "@/features/admin/api/adminApi";


const STATUS_BADGE: Record<string, string> = {
  active:   "bg-success-green/10 text-success-green ring-1 ring-success-green/20",
  disabled: "bg-slate-700/60 text-slate-500 ring-1 ring-slate-700",
};

const ROLE_COLORS: Record<string, string> = {
  Administrator:     "text-ferrari-red",
  "Team Manager":    "text-amber",
  "Race Engineer":   "text-blue-400",
  "Strategy Engineer": "text-purple-400",
  Mechanic:          "text-success-green",
  Driver:            "text-orange-400",
};

function formatUserAgent(ua?: string | null): string {
  if (!ua) return "Unknown Device";
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

function UserRow({
  user,
  selected,
  onToggleSelect,
  onToggle,
  onSelect,
  toggling,
}: {
  user: User;
  selected: boolean;
  onToggleSelect: (userId: string) => void;
  onToggle: (u: User) => void;
  onSelect: (u: User) => void;
  toggling: boolean;
}) {
  const isActive = user.status === "active";
  return (
    <tr className={`border-b border-slate-800/60 transition-colors ${selected ? "bg-slate-800/50" : "hover:bg-slate-800/30"}`}>
      <td className="py-3.5 pl-4 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(user.user_id)}
          className="rounded border-slate-700 bg-graphite-800 text-ferrari-red focus:ring-ferrari-red h-4 w-4 cursor-pointer"
        />
      </td>
      <td className="py-3.5 pl-2 cursor-pointer" onClick={() => onSelect(user)}>
        <div>
          <p className="text-sm font-medium text-slate-100 hover:text-ferrari-red transition-colors flex items-center gap-1.5">
            {user.full_name}
          </p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className={`text-xs font-semibold ${ROLE_COLORS[user.role?.role_name ?? ""] ?? "text-slate-400"}`}>
          {user.role?.role_name ?? "—"}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <span className="text-xs text-slate-400">{user.team?.team_name ?? "—"}</span>
      </td>
      <td className="py-3.5 px-4">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[user.status] ?? STATUS_BADGE.disabled}`}>
          {user.status}
        </span>
      </td>
      <td className="py-3.5 px-4 text-xs text-slate-500">
        {new Date(user.created_at).toLocaleDateString()}
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect(user)}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-all"
            title="View User Details & Login History"
          >
            <Eye size={12} /> Details
          </button>
          <button
            onClick={() => onToggle(user)}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
              ${isActive
                ? "border border-slate-700 text-slate-400 hover:border-red-500/40 hover:text-red-400"
                : "border border-slate-700 text-slate-500 hover:border-success-green/40 hover:text-success-green"
              } disabled:opacity-40`}
          >
            {isActive ? <><UserX size={12} /> Disable</> : <><CheckCircle2 size={12} /> Enable</>}
          </button>
        </div>
      </td>
    </tr>
  );
}

function UserDetailModal({ user, onClose }: { user: User; onClose: () => void }) {

  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const { data: history = [], isLoading: loadingHistory } = useQuery<LoginHistoryItem[]>({
    queryKey: ["admin-user-login-history", user.user_id],
    queryFn: () => fetchUserLoginHistory(user.user_id),
    enabled: activeTab === "history",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-100">{user.full_name}</h2>
              <span className={`text-xs font-semibold ${ROLE_COLORS[user.role?.role_name ?? ""] ?? "text-slate-400"}`}>
                • {user.role?.role_name ?? "User"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-graphite-800/40 px-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-ferrari-red text-ferrari-red"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            User Overview
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "history"
                ? "border-ferrari-red text-ferrari-red"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Login History
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "overview" ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Full Name</span>
                <span className="font-semibold text-slate-200 text-sm">{user.full_name}</span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Email Address</span>
                <span className="font-semibold text-slate-200 text-sm">{user.email}</span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Role</span>
                <span className={`font-semibold text-sm ${ROLE_COLORS[user.role?.role_name ?? ""] ?? "text-slate-200"}`}>
                  {user.role?.role_name ?? "—"}
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Assigned Team</span>
                <span className="font-semibold text-slate-200 text-sm">{user.team?.team_name ?? "No Team Assigned"}</span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Account Status</span>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[user.status] ?? STATUS_BADGE.disabled}`}>
                  {user.status}
                </span>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40">
                <span className="text-slate-500 font-mono uppercase tracking-wider block mb-1">Account Created</span>
                <span className="font-semibold text-slate-200 text-sm">{new Date(user.created_at).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div>
              {loadingHistory ? (
                <div className="flex h-48 items-center justify-center gap-2 font-mono text-xs text-slate-500">
                  <Activity size={18} className="animate-pulse text-ferrari-red" />
                  <span>Loading user session history…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
                  <Clock size={22} className="text-slate-600" />
                  <p>No recorded login history for this user.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-4">Date / Time</th>
                        <th className="py-2.5 px-4">IP Address</th>
                        <th className="py-2.5 px-4">Browser / Device</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors font-mono">
                          <td className="py-3 px-4 text-slate-200">
                            {new Date(item.logged_in_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5">
                            <Globe size={12} className="text-slate-500" />
                            {item.ip_address || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-300" title={item.user_agent || ""}>
                            <div className="flex items-center gap-1.5">
                              <Laptop size={12} className="text-slate-500" />
                              <span>{formatUserAgent(item.user_agent)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 px-6 py-3 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateUserModal({
  onClose,
  roles,
  teams,
}: {
  onClose: () => void;
  roles: { role_id: string; role_name: string }[];
  teams: { team_id: string; team_name: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserCreate>({
    full_name: "", email: "", password: "", role_id: "", team_id: "",
  });
  const [err, setErr] = useState("");

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to create user.");
    },
  });

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr("");
    const payload = { ...form };
    if (!payload.team_id) delete (payload as Partial<UserCreate>).team_id;
    mutation.mutate(payload);
  };

  const inputCls = "w-full rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Create New User</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} placeholder="e.g. Sophie Laurent" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} placeholder="engineer@ridss.team" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input type="password" className={inputCls} placeholder="Min 8 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls + " appearance-none"} value={form.role_id}
              onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} required>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Team <span className="text-slate-600 normal-case tracking-normal">(optional)</span></label>
            <select className={inputCls + " appearance-none"} value={form.team_id ?? ""}
              onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
              <option value="">No team</option>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
            </select>
          </div>
          {err && (
            <p className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={12} /> {err}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              {mutation.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Bulk action state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkConfirmTarget, setBulkConfirmTarget] = useState<"active" | "disabled" | null>(null);
  const [bulkError, setBulkError] = useState("");

  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, statusFilter],
    queryFn: () => fetchUsers({ query: search || undefined, role_id: roleFilter || undefined, status: statusFilter || undefined }),
  });

  const { data: roles = [] } = useQuery({ queryKey: ["admin-roles-list"], queryFn: fetchRoles });
  const { data: teams = [] } = useQuery({ queryKey: ["admin-teams-list"], queryFn: fetchTeams });

  const toggleMutation = useMutation({
    mutationFn: (u: User) =>
      toggleUserStatus(u.user_id, u.status === "active" ? "disabled" : "active"),
    onMutate: (u) => setTogglingId(u.user_id),
    onSettled: () => {
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () => {
      if (!bulkConfirmTarget) throw new Error("No target status set");
      return bulkUpdateUserStatus(selectedUserIds, bulkConfirmTarget);
    },
    onSuccess: () => {
      setSelectedUserIds([]);
      setBulkConfirmTarget(null);
      setBulkError("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setBulkError(e.response?.data?.detail ?? "Failed to perform bulk user update.");
    },
  });

  const handleToggleSelectAll = () => {
    if (users.length === 0) return;
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.user_id));
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Create, search, view session history, and manage RIDSS user accounts.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="w-full rounded-lg border border-slate-700 bg-graphite-800 pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all"
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
        </select>
        <select
          className="rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedUserIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between bg-graphite-800 border border-slate-700 rounded-lg px-4 py-3 shadow-lg"
          >
            <span className="text-xs font-semibold text-slate-200">
              {selectedUserIds.length} user{selectedUserIds.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setBulkConfirmTarget("active"); setBulkError(""); }}
                className="rounded-md bg-success-green/15 text-success-green ring-1 ring-success-green/30 px-3.5 py-1.5 text-xs font-semibold hover:bg-success-green/25 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Enable Selected
              </button>
              <button
                onClick={() => { setBulkConfirmTarget("disabled"); setBulkError(""); }}
                className="rounded-md bg-ferrari-red/15 text-red-400 ring-1 ring-ferrari-red/30 px-3.5 py-1.5 text-xs font-semibold hover:bg-ferrari-red/25 transition-all flex items-center gap-1.5"
              >
                <UserX size={13} /> Disable Selected
              </button>
              <button
                onClick={() => setSelectedUserIds([])}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 underline"
              >
                Deselect All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-2">
          <Shield size={14} className="text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {isLoading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Activity size={20} className="animate-pulse text-ferrari-red" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-slate-600 gap-2">
            <AlertCircle size={20} />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="py-3 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUserIds.length === users.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-700 bg-graphite-800 text-ferrari-red focus:ring-ferrari-red h-4 w-4 cursor-pointer"
                  />
                </th>
                {["User", "Role", "Team", "Status", "Created", "Actions"].map((h, idx) => (
                  <th key={h} className={`py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 ${idx === 0 ? "pl-2" : "px-4"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <UserRow
                  key={user.user_id}
                  user={user}
                  selected={selectedUserIds.includes(user.user_id)}
                  onToggleSelect={handleToggleSelectUser}
                  onSelect={setSelectedUser}
                  onToggle={() => toggleMutation.mutate(user)}
                  toggling={togglingId === user.user_id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Action Confirmation Modal */}
      <AnimatePresence>
        {bulkConfirmTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-amber font-bold text-base">
                <AlertTriangle size={22} />
                <span>Confirm Bulk Status Change</span>
              </div>
              <p className="text-sm text-slate-300">
                Are you sure you want to change the status of <span className="font-bold text-white">{selectedUserIds.length}</span> selected user(s) to{" "}
                <span className={`font-bold uppercase ${bulkConfirmTarget === "active" ? "text-success-green" : "text-red-400"}`}>
                  {bulkConfirmTarget}
                </span>?
              </p>
              <div className="text-xs text-slate-400 bg-graphite-800 p-3 rounded-lg border border-slate-800 space-y-1">
                <p className="font-semibold text-slate-300">Security & Audit Notice:</p>
                <p>• Higher-risk administrative action altering multiple user accounts simultaneously.</p>
                <p>• Writes one individual traceable audit log entry (<code className="text-amber">user_status_bulk_changed</code>) per affected user.</p>
              </div>
              {bulkError && (
                <p className="text-xs text-red-400 flex items-center gap-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  <AlertCircle size={14} className="shrink-0" /> {bulkError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setBulkConfirmTarget(null); setBulkError(""); }}
                  className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all ${
                    bulkConfirmTarget === "active" ? "bg-success-green hover:bg-success-green/90" : "bg-ferrari-red hover:bg-ferrari-red/90"
                  } disabled:opacity-50`}
                >
                  {bulkMutation.isPending ? "Applying..." : `Confirm ${bulkConfirmTarget === "active" ? "Enable" : "Disable"}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateUserModal
            onClose={() => setShowCreate(false)}
            roles={roles}
            teams={teams}
          />
        )}
      </AnimatePresence>

      {/* User Details & Login History Modal */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

