"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertCircle, Archive, Bell, BellOff, CheckCircle2, Send, X,
} from "lucide-react";
import { useState } from "react";
import {
  archiveNotification, fetchNotifications, fetchUsers,
  sendNotification, type Notification, type NotificationCreate,
} from "@/features/admin/api/adminApi";

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_STYLES: Record<string, string> = {
  unread:   "bg-blue-400/10 text-blue-400 ring-1 ring-blue-400/20",
  read:     "bg-slate-700/40 text-slate-500 ring-1 ring-slate-700",
  archived: "bg-slate-800/40 text-slate-600 ring-1 ring-slate-800",
};

// ── Send Notification Modal ────────────────────────────────────────────────────

function SendNotificationModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NotificationCreate>({ user_ids: [], title: "", message: "" });
  const [broadcast, setBroadcast] = useState(false);
  const [err, setErr] = useState("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const mutation = useMutation({
    mutationFn: (payload: NotificationCreate) => sendNotification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      onClose();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? "Failed to send notification.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const payload: NotificationCreate = {
      ...form,
      user_ids: broadcast ? allUsers.map(u => u.user_id) : form.user_ids,
    };
    if (payload.user_ids.length === 0) {
      setErr("Select at least one recipient.");
      return;
    }
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
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-100">Send Notification</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Broadcast toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-graphite-800 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Broadcast to all users</p>
              <p className="text-xs text-slate-500">Send to every registered account</p>
            </div>
            <button
              type="button"
              onClick={() => setBroadcast(b => !b)}
              className={`relative h-6 w-11 rounded-full transition-all ${broadcast ? "bg-ferrari-red" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${broadcast ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* User selector when not broadcast */}
          {!broadcast && (
            <div>
              <label className={labelCls}>Recipients</label>
              <select
                multiple
                className={inputCls + " h-32"}
                value={form.user_ids}
                onChange={e => setForm(f => ({ ...f, user_ids: Array.from(e.target.selectedOptions, o => o.value) }))}
              >
                {allUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} — {u.role?.role_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-600">Hold Ctrl/Cmd to select multiple</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} placeholder="e.g. Urgent: Pre-race briefing updated" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea className={inputCls + " resize-none"} rows={4}
              placeholder="Enter your notification message…"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
          </div>

          {err && <p className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-ferrari-red py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 disabled:opacity-60 transition-all">
              <Send size={14} />
              {mutation.isPending ? "Sending…" : broadcast ? `Broadcast to All (${allUsers.length})` : "Send"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Notification Row ───────────────────────────────────────────────────────────

function NotificationRow({
  notif, onArchive, archiving,
}: {
  notif: Notification;
  onArchive: (id: string) => void;
  archiving: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-surface p-4 transition-all hover:border-slate-700"
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        notif.status === "unread" ? "bg-blue-400/10" : "bg-slate-800"
      }`}>
        {notif.status === "archived"
          ? <BellOff size={14} className="text-slate-600" />
          : <Bell size={14} className={notif.status === "unread" ? "text-blue-400" : "text-slate-500"} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">{notif.title}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[notif.status] ?? STATUS_STYLES.read}`}>
            {notif.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400 line-clamp-2">{notif.message}</p>
        <p className="mt-1.5 text-[11px] text-slate-600">{formatRelative(notif.created_at)}</p>
      </div>
      {notif.status !== "archived" && (
        <button
          onClick={() => onArchive(notif.notification_id)}
          disabled={archiving}
          title="Archive"
          className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-slate-700/40 hover:text-slate-400 transition-all disabled:opacity-40"
        >
          <Archive size={14} />
        </button>
      )}
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [showSend, setShowSend] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "archived">("all");
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: fetchNotifications,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveNotification(id),
    onMutate: (id) => setArchivingId(id),
    onSettled: () => {
      setArchivingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const filtered = notifications.filter(n => filter === "all" || n.status === filter);
  const unreadCount = notifications.filter(n => n.status === "unread").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send and manage system notifications.
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-blue-400/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowSend(true)}
          className="flex items-center gap-2 rounded-lg bg-ferrari-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-ferrari-red/90 transition-all"
        >
          <Send size={16} /> Send Notification
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {(["all", "unread", "read", "archived"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
              filter === f ? "bg-slate-surface text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f}
            {f === "all" && notifications.length > 0 && (
              <span className="ml-1.5 text-slate-600">({notifications.length})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Activity size={24} className="animate-pulse text-ferrari-red" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-600">
          <Bell size={32} />
          <p className="text-sm">No {filter === "all" ? "" : filter} notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(notif => (
              <NotificationRow
                key={notif.notification_id}
                notif={notif}
                onArchive={id => archiveMutation.mutate(id)}
                archiving={archivingId === notif.notification_id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showSend && <SendNotificationModal onClose={() => setShowSend(false)} />}
      </AnimatePresence>
    </div>
  );
}
