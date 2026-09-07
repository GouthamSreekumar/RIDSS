"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckSquare, Plus, Shield, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createRole, fetchRoleMatrix, updateRolePermissions,
  type Permission, type RoleMatrixEntry,
} from "@/features/admin/api/adminApi";

// ── Role column header ─────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Administrator:       "text-ferrari-red border-ferrari-red/30 bg-ferrari-red/5",
  "Team Manager":      "text-amber border-amber/30 bg-amber/5",
  "Race Engineer":     "text-blue-400 border-blue-400/30 bg-blue-400/5",
  "Strategy Engineer": "text-purple-400 border-purple-400/30 bg-purple-400/5",
  Mechanic:            "text-success-green border-success-green/30 bg-success-green/5",
  Driver:              "text-orange-400 border-orange-400/30 bg-orange-400/5",
};

// ── Create Role Modal ──────────────────────────────────────────────────────────

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  const mutation = useMutation({
    mutationFn: () => createRole({ role_name: roleName, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-matrix"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to create role.");
    },
  });

  const inputCls = "w-full rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Create New Role</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Role Name</label>
            <input className={inputCls} placeholder="e.g. Data Analyst" value={roleName}
              onChange={e => setRoleName(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Description <span className="text-slate-600 normal-case tracking-normal">(optional)</span></label>
            <textarea className={inputCls + " resize-none"} rows={2} placeholder="Brief description…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {err && <p className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              {mutation.isPending ? "Creating…" : "Create Role"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Permission Matrix ──────────────────────────────────────────────────────────

function PermissionMatrix({
  roles, modules, onSave, saving,
}: {
  roles: RoleMatrixEntry[];
  modules: Record<string, Permission[]>;
  onSave: (roleId: string, permIds: string[]) => void;
  saving: string | null;
}) {
  // Local state: roleId → Set of permission_ids
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    roles.forEach(r => { initial[r.role_id] = new Set(r.permission_ids); });
    return initial;
  });

  // Sync when roles data changes
  useEffect(() => {
    setDraft(prev => {
      const next = { ...prev };
      roles.forEach(r => {
        if (!next[r.role_id]) next[r.role_id] = new Set(r.permission_ids);
      });
      return next;
    });
  }, [roles]);

  const togglePerm = (roleId: string, permId: string) => {
    setDraft(prev => {
      const set = new Set(prev[roleId] ?? []);
      if (set.has(permId)) set.delete(permId); else set.add(permId);
      return { ...prev, [roleId]: set };
    });
  };

  const isDirty = (roleId: string) => {
    const orig = new Set(roles.find(r => r.role_id === roleId)?.permission_ids ?? []);
    const curr = draft[roleId] ?? new Set();
    if (orig.size !== curr.size) return true;
    for (const id of orig) if (!curr.has(id)) return true;
    return false;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/60">
            <th className="py-3 pl-4 pr-6 text-left text-xs font-semibold uppercase tracking-widest text-slate-500 w-48">
              Permission
            </th>
            {roles.map(role => (
              <th key={role.role_id} className="py-3 px-3 text-center min-w-[110px]">
                <div className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${ROLE_COLORS[role.role_name] ?? "text-slate-400 border-slate-700"}`}>
                  {role.role_name}
                </div>
                {isDirty(role.role_id) && (
                  <div className="mt-1">
                    <button
                      onClick={() => onSave(role.role_id, [...(draft[role.role_id] ?? [])])}
                      disabled={saving === role.role_id}
                      className="rounded-md bg-ferrari-red/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ferrari-red ring-1 ring-ferrari-red/20 hover:bg-ferrari-red/25 transition-all disabled:opacity-50"
                    >
                      {saving === role.role_id ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(modules).map(([module, perms]) => (
            <>
              {/* Module group header */}
              <tr key={`module-${module}`} className="border-b border-slate-800/40 bg-graphite-700/30">
                <td colSpan={roles.length + 1} className="py-2 pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{module}</span>
                </td>
              </tr>
              {perms.map(perm => (
                <tr key={perm.permission_id} className="border-b border-slate-800/30 transition-colors hover:bg-slate-800/20">
                  <td className="py-2.5 pl-4 pr-6">
                    <p className="text-xs font-medium text-slate-300">{perm.permission_key}</p>
                    <p className="text-[11px] text-slate-600">{perm.description}</p>
                  </td>
                  {roles.map(role => {
                    const has = draft[role.role_id]?.has(perm.permission_id) ?? false;
                    return (
                      <td key={role.role_id} className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => togglePerm(role.role_id, perm.permission_id)}
                          className={`transition-colors ${has ? "text-success-green hover:text-success-green/70" : "text-slate-700 hover:text-slate-500"}`}
                          title={has ? "Revoke permission" : "Grant permission"}
                        >
                          {has ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: matrix, isLoading, isError } = useQuery({
    queryKey: ["admin-role-matrix"],
    queryFn: fetchRoleMatrix,
  });

  const saveMutation = useMutation({
    mutationFn: ({ roleId, permIds }: { roleId: string; permIds: string[] }) =>
      updateRolePermissions(roleId, permIds),
    onMutate: ({ roleId }) => setSaving(roleId),
    onSettled: () => {
      setSaving(null);
      queryClient.invalidateQueries({ queryKey: ["admin-role-matrix"] });
    },
  });

  const totalPerms = useMemo(
    () => Object.values(matrix?.modules ?? {}).reduce((acc, p) => acc + p.length, 0),
    [matrix]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            {matrix ? `${matrix.roles.length} roles · ${totalPerms} permissions` : "Loading role matrix…"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-surface px-4 py-3">
        <Shield size={14} className="text-slate-500 shrink-0" />
        <p className="text-xs text-slate-500">
          Toggle checkboxes to change permissions per role. A <span className="font-semibold text-ferrari-red">Save</span> button appears above each column with unsaved changes.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
        </div>
      ) : isError || !matrix ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
          <AlertCircle size={24} className="text-amber" />
          <p className="text-sm">Failed to load permission matrix.</p>
        </div>
      ) : (
        <PermissionMatrix
          roles={matrix.roles}
          modules={matrix.modules}
          onSave={(roleId, permIds) => saveMutation.mutate({ roleId, permIds })}
          saving={saving}
        />
      )}

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
