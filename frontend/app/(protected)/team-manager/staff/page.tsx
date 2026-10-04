"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Clock,
  Edit2,
  Filter,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  useTeamStaff,
  useUpdateTeamStaffMember,
  type StaffMemberItem,
} from "@/features/team-manager/api/teamManagerApi";

// ── Helper to format Tenure from team_since date ─────────────────────────────
function formatTenure(teamSince?: string | null): { dateStr: string; text: string } {
  if (!teamSince) {
    return { dateStr: "Not set", text: "No tenure recorded" };
  }
  try {
    const joinedDate = new Date(teamSince);
    if (isNaN(joinedDate.getTime())) {
      return { dateStr: teamSince, text: `On team since ${teamSince}` };
    }
    const formattedDate = joinedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const now = new Date();
    const diffYears = now.getFullYear() - joinedDate.getFullYear();
    const diffMonths = now.getMonth() - joinedDate.getMonth() + diffYears * 12;

    let tenureText = "";
    if (diffMonths < 1) {
      tenureText = "Joined recently";
    } else if (diffMonths < 12) {
      tenureText = `${diffMonths} month${diffMonths > 1 ? "s" : ""} with team`;
    } else {
      const yrs = Math.floor(diffMonths / 12);
      const mos = diffMonths % 12;
      tenureText = `${yrs} yr${yrs > 1 ? "s" : ""}${mos > 0 ? ` ${mos} mo` : ""} with team`;
    }

    return {
      dateStr: formattedDate,
      text: `On team since ${formattedDate} (${tenureText})`,
    };
  } catch {
    return { dateStr: teamSince, text: `On team since ${teamSince}` };
  }
}

// ── Role Color Helper ────────────────────────────────────────────────────────
function getRoleBadgeStyle(roleName: string) {
  switch (roleName.toLowerCase()) {
    case "driver":
      return "border-ferrari-red/40 bg-ferrari-red/10 text-ferrari-red";
    case "race engineer":
      return "border-cyan-500/40 bg-cyan-950/40 text-cyan-400";
    case "strategy engineer":
      return "border-purple-500/40 bg-purple-950/40 text-purple-400";
    case "mechanic":
      return "border-amber/40 bg-amber/10 text-amber";
    case "team manager":
      return "border-blue-500/40 bg-blue-950/40 text-blue-400";
    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

// ── Edit Staff Tenure Modal ──────────────────────────────────────────────────
function EditStaffTenureModal({
  staffMember,
  onClose,
}: {
  staffMember: StaffMemberItem;
  onClose: () => void;
}) {
  const [teamSince, setTeamSince] = useState(staffMember.team_since ?? "");
  const [fullName, setFullName] = useState(staffMember.full_name);
  const [err, setErr] = useState("");

  const updateMutation = useUpdateTeamStaffMember();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    updateMutation.mutate(
      {
        userId: staffMember.user_id,
        payload: {
          team_since: teamSince || null,
          full_name: fullName,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: any) => {
          setErr(error.response?.data?.detail ?? "Failed to update staff member details.");
        },
      }
    );
  };

  const inputCls =
    "w-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors";
  const labelCls = "mb-1 block text-xs font-semibold text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 0 }}
        className="w-full max-w-md border-2 border-slate-800 bg-slate-950 border-l-2 border-l-cyan-500"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Edit Staff Member: {staffMember.full_name}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 font-sans">
          <div>
            <label className={labelCls}>Full Name</label>
            <input
              type="text"
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Team Join Date (team_since)</label>
              {teamSince && (
                <button
                  type="button"
                  onClick={() => setTeamSince("")}
                  className="text-[11px] text-slate-500 hover:text-red-400 font-mono transition-colors"
                >
                  Clear date
                </button>
              )}
            </div>
            <input
              type="date"
              className={inputCls}
              value={teamSince}
              onChange={(e) => setTeamSince(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Sets "On team since [date]" tenure displayed across staff directory and team views.
            </p>
          </div>

          <div>
            <label className={labelCls}>Assigned Role</label>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-mono font-bold border ${getRoleBadgeStyle(staffMember.role_name)}`}>
                {staffMember.role_name}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Role is managed via Admin settings.</span>
            </div>
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
              <AlertCircle size={13} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 bg-slate-900 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 border border-cyan-500 bg-cyan-500 py-2 text-xs font-mono font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              {updateMutation.isPending ? "Saving…" : "Save tenure"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Bulk Staff Tenure Modal ──────────────────────────────────────────────────
function BulkStaffTenureModal({
  staffList,
  onClose,
}: {
  staffList: StaffMemberItem[];
  onClose: () => void;
}) {
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    staffList.forEach((s) => {
      initial[s.user_id] = s.team_since ?? "";
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const updateMutation = useUpdateTeamStaffMember();

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");

    try {
      const promises = staffList.map((s) => {
        const newDate = dates[s.user_id]?.trim() || null;
        if (newDate !== (s.team_since ?? null)) {
          return updateMutation.mutateAsync({
            userId: s.user_id,
            payload: {
              team_since: newDate,
            },
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      onClose();
    } catch (error: any) {
      setErr(error.response?.data?.detail ?? "Failed to update staff tenure dates.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 0 }}
        className="w-full max-w-2xl border-2 border-slate-800 bg-slate-950 border-l-2 border-l-cyan-500"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">Set staff tenure dates (Bulk backfill)</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveAll} className="p-5 space-y-4 font-sans max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-400">
            Backfill or update team join dates (<span className="font-mono text-cyan-400">team_since</span>) for all operational team personnel in a single pass.
          </p>

          <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-900/40">
            {staffList.map((s) => {
              const currentDate = dates[s.user_id] ?? "";
              const hasOriginalDate = Boolean(s.team_since);

              return (
                <div key={s.user_id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border shrink-0 ${getRoleBadgeStyle(s.role_name)}`}>
                      {s.role_name}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-100">{s.full_name}</p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {hasOriginalDate ? `Currently: ${s.team_since}` : <span className="text-amber">No tenure recorded</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-64">
                    <input
                      type="date"
                      className={inputCls}
                      value={currentDate}
                      onChange={(e) =>
                        setDates((prev) => ({ ...prev, [s.user_id]: e.target.value }))
                      }
                    />
                    {currentDate && (
                      <button
                        type="button"
                        onClick={() =>
                          setDates((prev) => ({ ...prev, [s.user_id]: "" }))
                        }
                        className="text-[10px] text-slate-500 hover:text-red-400 font-mono px-1 shrink-0"
                        title="Clear date"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
              <AlertCircle size={13} /> {err}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 bg-slate-900 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 border border-cyan-500 bg-cyan-500 py-2 text-xs font-mono font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving all…" : "Save all tenure dates"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Staff Directory Page Main Component ──────────────────────────────────────
export default function TeamStaffDirectoryPage() {
  const { data: staffList = [], isLoading, error } = useTeamStaff();
  const [editingStaff, setEditingStaff] = useState<StaffMemberItem | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role_name.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const staffWithTenureCount = staffList.filter((s) => Boolean(s.team_since)).length;
  const staffMissingTenureCount = staffList.length - staffWithTenureCount;

  // Extract unique roles for filter dropdown
  const uniqueRoles = Array.from(new Set(staffList.map((s) => s.role_name)));

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Staff Directory</h1>
          <p className="mt-1 text-xs text-slate-400">
            Overview of operational team personnel, role assignments, and team-wide tenure contract dates.
          </p>
        </div>
        <button
          onClick={() => setShowBulkModal(true)}
          className="flex items-center gap-1.5 border border-cyan-500 bg-cyan-500 px-4 py-2 text-xs font-mono font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
        >
          <Clock size={14} /> Bulk set tenure
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-blue-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total operational staff</p>
            <p className="mt-1 text-3xl font-bold font-mono tabular-nums text-slate-100">{staffList.length}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 text-blue-400">
            <Users size={18} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Tenure recorded</p>
            <p className="mt-1 text-3xl font-bold font-mono tabular-nums text-emerald-400">{staffWithTenureCount}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 text-emerald-400">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Tenure unrecorded</p>
            <p className={`mt-1 text-3xl font-bold font-mono tabular-nums ${staffMissingTenureCount > 0 ? "text-amber" : "text-slate-400"}`}>
              {staffMissingTenureCount}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center border border-slate-800 bg-slate-900 ${staffMissingTenureCount > 0 ? "text-amber" : "text-slate-500"}`}>
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800 bg-slate-surface p-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search staff by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-700 bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-500 shrink-0" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-48 border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="all">All Roles ({staffList.length})</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>
                {r} ({staffList.filter((s) => s.role_name === r).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-slate-500 font-mono text-xs">
          <Activity size={20} className="animate-pulse text-cyan-400" />
          <span>Fetching team staff directory…</span>
        </div>
      ) : error ? (
        <div className="border border-red-500/40 bg-red-950/20 p-4 text-xs font-mono text-red-400 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>Failed to load team staff directory. Please try again.</span>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="flex h-44 flex-col items-center justify-center gap-2 border border-slate-800 bg-slate-surface text-slate-500 font-mono text-xs">
          <AlertCircle size={20} />
          <p>No team staff members found matching your search filters.</p>
        </div>
      ) : (
        <div className="border border-slate-800 bg-slate-surface border-l-2 border-l-cyan-500 overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-400">
                <th className="py-3.5 px-5">Staff member</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Driver details</th>
                <th className="py-3.5 px-5">Tenure / Team join date</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredStaff.map((staff) => {
                const tenureInfo = formatTenure(staff.team_since);

                return (
                  <tr key={staff.user_id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div>
                        <p className="font-semibold text-slate-100">{staff.full_name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{staff.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase border ${getRoleBadgeStyle(staff.role_name)}`}>
                        {staff.role_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-400">
                      {staff.driver_number ? (
                        <div className="flex items-center gap-1.5">
                          <span className="border border-ferrari-red/40 bg-ferrari-red/10 px-1.5 py-0.5 text-ferrari-red font-bold">
                            #{staff.driver_number}
                          </span>
                          {staff.fastf1_code && <span className="text-slate-300">({staff.fastf1_code})</span>}
                          {staff.nationality && <span className="text-slate-500 text-[11px]">— {staff.nationality}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className={staff.team_since ? "text-cyan-400" : "text-amber"} />
                        <span className={`text-[11px] ${staff.team_since ? "text-slate-200" : "text-amber"}`}>
                          {tenureInfo.text}
                        </span>
                        <button
                          onClick={() => setEditingStaff(staff)}
                          className="ml-1 text-slate-500 hover:text-cyan-400 transition-colors"
                          title="Edit staff tenure"
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setEditingStaff(staff)}
                        className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                      >
                        <Edit2 size={11} /> Edit tenure
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Staff Tenure Modal */}
      <AnimatePresence>
        {editingStaff && (
          <EditStaffTenureModal
            staffMember={editingStaff}
            onClose={() => setEditingStaff(null)}
          />
        )}
      </AnimatePresence>

      {/* Bulk Staff Tenure Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkStaffTenureModal
            staffList={staffList}
            onClose={() => setShowBulkModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
