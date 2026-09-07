"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertCircle, Building2, Plus, Trash2, UserMinus, UserPlus, Users, X,
} from "lucide-react";
import { useState } from "react";
import {
  assignTeamMember, createTeam, deleteTeam, fetchTeamDetail,
  fetchTeams, fetchUsers, removeTeamMember,
  type Team, type TeamCreate, type TeamDetail,
} from "@/features/admin/api/adminApi";

// ── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team, onSelect, onDelete,
}: {
  team: Team;
  onSelect: (t: Team) => void;
  onDelete: (t: Team) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group relative rounded-xl border border-slate-800 bg-slate-surface p-5 transition-all hover:border-slate-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber/10 ring-1 ring-amber/20">
            <Building2 size={18} className="text-amber" />
          </div>
          <div>
            <p className="font-semibold text-slate-100">{team.team_name}</p>
            <p className="text-xs text-slate-500">{team.principal ?? "No principal"}</p>
          </div>
        </div>
        <button
          onClick={() => onDelete(team)}
          className="opacity-0 group-hover:opacity-100 rounded-md p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {team.headquarters && (
        <p className="mt-3 text-xs text-slate-600">{team.headquarters}</p>
      )}
      <button
        onClick={() => onSelect(team)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/60 py-2 text-xs text-slate-400 transition-all hover:border-amber/40 hover:text-amber"
      >
        <Users size={12} /> View Members
      </button>
    </motion.div>
  );
}

// ── Team Detail Drawer ────────────────────────────────────────────────────────

function TeamDetailDrawer({
  teamId, onClose,
}: {
  teamId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: detail, isLoading } = useQuery<TeamDetail>({
    queryKey: ["admin-team-detail", teamId],
    queryFn: () => fetchTeamDetail(teamId),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignTeamMember(teamId, selectedUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-team-detail", teamId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedUserId("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-team-detail", teamId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const memberIds = new Set(detail?.members.map(m => m.user_id) ?? []);
  const availableUsers = allUsers.filter(u => !memberIds.has(u.user_id));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-surface px-6 py-4">
          <div>
            <p className="font-bold text-slate-100">{detail?.team_name ?? "Team"}</p>
            <p className="text-xs text-slate-500">{(detail?.members?.length ?? 0)} members</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Assign member */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Assign Member</p>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-ferrari-red"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
              >
                <option value="">Select user…</option>
                {availableUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role?.role_name})</option>
                ))}
              </select>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedUserId || assignMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-ferrari-red px-3 py-2 text-xs font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-50 transition-all"
              >
                <UserPlus size={13} /> Assign
              </button>
            </div>
          </div>

          {/* Members list */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Current Members</p>
            {isLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Activity size={16} className="animate-pulse text-ferrari-red" />
              </div>
            ) : (detail?.members ?? []).length === 0 ? (
              <p className="text-center text-sm text-slate-600 py-8">No members assigned.</p>
            ) : (
              <div className="space-y-2">
                {(detail?.members ?? []).map(member => (
                  <div key={member.user_id} className="flex items-center justify-between rounded-lg bg-graphite-800 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{member.full_name}</p>
                      <p className="text-xs text-slate-500">{member.role?.role_name ?? "—"}</p>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(member.user_id)}
                      disabled={removeMutation.isPending}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-40"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Create Team Modal ──────────────────────────────────────────────────────────

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamCreate>({ team_name: "", principal: "", headquarters: "" });
  const [err, setErr] = useState("");

  const mutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to create team.");
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
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Create New Team</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Team Name</label>
            <input className={inputCls} placeholder="e.g. Scuderia Ferrari" value={form.team_name}
              onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Team Principal <span className="text-slate-600 normal-case tracking-normal">(optional)</span></label>
            <input className={inputCls} placeholder="e.g. Fred Vasseur" value={form.principal ?? ""}
              onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Headquarters <span className="text-slate-600 normal-case tracking-normal">(optional)</span></label>
            <input className={inputCls} placeholder="e.g. Maranello, Italy" value={form.headquarters ?? ""}
              onChange={e => setForm(f => ({ ...f, headquarters: e.target.value }))} />
          </div>
          {err && <p className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              {mutation.isPending ? "Creating…" : "Create Team"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: fetchTeams,
  });

  const deleteMutation = useMutation({
    mutationFn: (t: Team) => deleteTeam(t.team_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Management</h1>
          <p className="mt-1 text-sm text-slate-500">Create race teams and assign members.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all"
        >
          <Plus size={16} /> New Team
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
        </div>
      ) : teams.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
          <Building2 size={32} />
          <p className="text-sm">No teams yet. Create one to get started.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {teams.map(team => (
              <TeamCard
                key={team.team_id}
                team={team}
                onSelect={setSelectedTeam}
                onDelete={t => {
                  if (confirm(`Delete team "${t.team_name}"? This cannot be undone.`)) {
                    deleteMutation.mutate(t);
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {selectedTeam && (
          <TeamDetailDrawer
            teamId={selectedTeam.team_id}
            onClose={() => setSelectedTeam(null)}
          />
        )}
        {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
