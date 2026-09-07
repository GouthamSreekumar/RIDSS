"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertCircle, CheckCircle2, Plus, Search, Shield, UserX, X,
} from "lucide-react";
import { useState } from "react";
import {
  createUser, fetchRoles, fetchTeams, fetchUsers, toggleUserStatus,
  type User, type UserCreate,
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

function UserRow({
  user, onToggle, toggling,
}: {
  user: User; onToggle: (u: User) => void; toggling: boolean;
}) {
  const isActive = user.status === "active";
  return (
    <tr className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/30">
      <td className="py-3.5 pl-4">
        <div>
          <p className="text-sm font-medium text-slate-100">{user.full_name}</p>
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
      </td>
    </tr>
  );
}

function CreateUserModal({
  onClose, roles, teams,
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
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Create, search, and manage RIDSS user accounts.</p>
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
                {["User", "Role", "Team", "Status", "Created", "Actions"].map(h => (
                  <th key={h} className="py-3 pl-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <UserRow
                  key={user.user_id} user={user}
                  onToggle={() => toggleMutation.mutate(user)}
                  toggling={togglingId === user.user_id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}
