"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchSettings, updateSettings, type SystemSetting } from "@/features/admin/api/adminApi";

const CATEGORY_ICONS: Record<string, string> = {
  authentication: "🔐",
  session:        "⏱️",
  email:          "📧",
  general:        "⚙️",
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
