"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchRetentionSettings,
  fetchSettings,
  triggerRetentionPruning,
  updateRetentionSettings,
  updateSettings,
  type SystemSetting,
} from "@/features/admin/api/adminApi";
import { Database, Play, Trash2 } from "lucide-react";

const CATEGORY_ICONS: Record<string, string> = {
  authentication: "🔐",
  session:        "⏱️",
  email:          "📧",
  general:        "⚙️",
  retention:      "📦",
};

const BOOLEAN_KEYS = new Set(["auth.require_mfa"]);

function SettingRow({
  setting,
  value,
  onChange,
}: {
  setting: SystemSetting;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  const isBoolean = BOOLEAN_KEYS.has(setting.key);
  const inputCls = "w-full rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red focus:border-transparent transition-all";

  return (
    <div className="flex items-center justify-between gap-6 rounded-lg bg-graphite-800 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{setting.key}</p>
        {setting.updated_at && (
          <p className="text-xs text-slate-600 mt-0.5">
            Updated {new Date(setting.updated_at).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="w-40 shrink-0">
        {isBoolean ? (
          <button
            type="button"
            onClick={() => onChange(setting.key, value === "true" ? "false" : "true")}
            className={`relative h-6 w-11 rounded-full transition-all ${value === "true" ? "bg-ferrari-red" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value === "true" ? "left-5" : "left-0.5"}`} />
          </button>
        ) : (
          <input
            className={inputCls}
            value={value}
            onChange={e => onChange(setting.key, e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function RetentionPolicySection() {
  const queryClient = useQueryClient();
  const [auditDays, setAuditDays] = useState<number | null>(null);
  const [loginDays, setLoginDays] = useState<number | null>(null);
  const [keepAuditForever, setKeepAuditForever] = useState(true);
  const [keepLoginForever, setKeepLoginForever] = useState(true);
  const [saved, setSaved] = useState(false);
  const [pruneResult, setPruneResult] = useState<string | null>(null);

  const { data: retentionData, isLoading } = useQuery({
    queryKey: ["admin-retention-settings"],
    queryFn: fetchRetentionSettings,
  });

  useEffect(() => {
    if (retentionData) {
      if (retentionData.audit_log_retention_days !== null && retentionData.audit_log_retention_days > 0) {
        setKeepAuditForever(false);
        setAuditDays(retentionData.audit_log_retention_days);
      } else {
        setKeepAuditForever(true);
        setAuditDays(null);
      }

      if (retentionData.login_history_retention_days !== null && retentionData.login_history_retention_days > 0) {
        setKeepLoginForever(false);
        setLoginDays(retentionData.login_history_retention_days);
      } else {
        setKeepLoginForever(true);
        setLoginDays(null);
      }
    }
  }, [retentionData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRetentionSettings({
        audit_log_retention_days: keepAuditForever ? null : (auditDays ?? 90),
        login_history_retention_days: keepLoginForever ? null : (loginDays ?? 90),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-retention-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const pruneMutation = useMutation({
    mutationFn: triggerRetentionPruning,
    onSuccess: (data) => {
      setPruneResult(
        `Pruned ${data.audit_logs_pruned} audit log(s) and ${data.login_history_pruned} login history record(s).`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      setTimeout(() => setPruneResult(null), 6000);
    },
  });

  const inputCls =
    "rounded-lg border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ferrari-red transition-all w-28 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden space-y-4"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-ferrari-red" />
          <h2 className="text-sm font-semibold capitalize text-slate-300">Data Retention & Archival Policy</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pruneMutation.mutate()}
            disabled={pruneMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-graphite-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-all disabled:opacity-50"
            title="Execute periodic data cleanup job immediately"
          >
            {pruneMutation.isPending ? <Activity size={13} className="animate-spin" /> : <Play size={13} className="text-amber" />}
            {pruneMutation.isPending ? "Pruning…" : "Run Cleanup Now"}
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-ferrari-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-ferrari-red/90 transition-all disabled:opacity-50"
          >
            {saved ? <CheckCircle2 size={13} /> : saveMutation.isPending ? <Activity size={13} className="animate-spin" /> : <Save size={13} />}
            {saved ? "Saved Policy" : saveMutation.isPending ? "Saving…" : "Save Policy"}
          </button>
        </div>
      </div>

      {pruneResult && (
        <div className="mx-4 p-3 rounded-lg bg-amber/10 border border-amber/20 text-xs text-amber flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 size={14} />
            <span>{pruneResult}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Pruning audit log written</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Activity size={18} className="animate-pulse text-ferrari-red" />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Audit Log Retention */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-graphite-800 p-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Audit Log Retention Window</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically prune audit log entries older than specified days.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={keepAuditForever}
                  onChange={e => {
                    setKeepAuditForever(e.target.checked);
                    if (e.target.checked) setAuditDays(null);
                    else if (!auditDays) setAuditDays(90);
                  }}
                  className="rounded border-slate-700 bg-graphite-800 text-ferrari-red focus:ring-ferrari-red h-4 w-4 cursor-pointer"
                />
                <span>Keep Indefinitely</span>
              </label>
              {!keepAuditForever && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={auditDays ?? 90}
                    onChange={e => setAuditDays(parseInt(e.target.value) || 90)}
                    disabled={keepAuditForever}
                    className={inputCls}
                  />
                  <span className="text-xs text-slate-500 font-mono">days</span>
                </div>
              )}
            </div>
          </div>

          {/* Login History Retention */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg bg-graphite-800 p-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Login History Retention Window</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically prune user login & session records older than specified days.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={keepLoginForever}
                  onChange={e => {
                    setKeepLoginForever(e.target.checked);
                    if (e.target.checked) setLoginDays(null);
                    else if (!loginDays) setLoginDays(90);
                  }}
                  className="rounded border-slate-700 bg-graphite-800 text-ferrari-red focus:ring-ferrari-red h-4 w-4 cursor-pointer"
                />
                <span>Keep Indefinitely</span>
              </label>
              {!keepLoginForever && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={loginDays ?? 90}
                    onChange={e => setLoginDays(parseInt(e.target.value) || 90)}
                    disabled={keepLoginForever}
                    className={inputCls}
                  />
                  <span className="text-xs text-slate-500 font-mono">days</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data: settings = [], isLoading, isError } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchSettings,
  });

  // Initialize draft from server data
  useEffect(() => {
    if (settings.length > 0) {
      const initial: Record<string, string> = {};
      settings.forEach(s => { initial[s.key] = s.value; });
      setDraft(initial);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // Group settings by category
  const grouped = settings.reduce<Record<string, SystemSetting[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] ?? []).push(s);
    return acc;
  }, {});

  const isDirty = settings.some(s => draft[s.key] !== s.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">System Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Configure global platform behaviour.</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all
            ${saved
              ? "bg-success-green/15 text-success-green ring-1 ring-success-green/20"
              : isDirty
                ? "bg-ferrari-red text-white hover:bg-ferrari-red/90"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
        >
          {saved
            ? <><CheckCircle2 size={16} /> Saved</>
            : saveMutation.isPending
              ? <><Activity size={16} className="animate-spin" /> Saving…</>
              : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-surface px-4 py-3">
        <Settings size={14} className="text-slate-500 shrink-0" />
        <p className="text-xs text-slate-500">
          Changes take effect immediately after saving. Modify with care — these settings affect all users.
        </p>
      </div>

      {/* Data Retention Section */}
      <RetentionPolicySection />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
          <AlertCircle size={24} className="text-amber" />
          <p className="text-sm">Failed to load settings.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catSettings]) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-slate-800 bg-slate-surface overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3.5">
                <span className="text-base">{CATEGORY_ICONS[category] ?? "⚙️"}</span>
                <h2 className="text-sm font-semibold capitalize text-slate-300">{category}</h2>
                <span className="ml-auto text-xs text-slate-600">{catSettings.length} setting{catSettings.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2 p-4">
                {catSettings.map(s => (
                  <SettingRow
                    key={s.setting_id}
                    setting={s}
                    value={draft[s.key] ?? s.value}
                    onChange={(key, val) => setDraft(d => ({ ...d, [key]: val }))}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

