"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  Bell,
  BellOff,
  CheckCircle2,
  ExternalLink,
  FileText,
  RefreshCw,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import apiClient from "@/lib/axios";

export interface NotificationItem {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  status: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_STYLES: Record<string, string> = {
  unread: "bg-ferrari-red/15 text-ferrari-red ring-1 ring-ferrari-red/30 font-bold",
  read: "bg-slate-800/40 text-slate-400 ring-1 ring-slate-700",
  archived: "bg-slate-900/60 text-slate-600 ring-1 ring-slate-800",
};

export function SharedNotificationsPage({ roleTitle }: { roleTitle: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "archived">("all");

  const { data: notifications = [], isLoading, isError, error, refetch } = useQuery<NotificationItem[]>({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const res = await apiClient.get<NotificationItem[]>("/api/v1/notifications/my");
      return res.data;
    },
    staleTime: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const res = await apiClient.patch(`/api/v1/notifications/${notifId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const res = await apiClient.patch(`/api/v1/notifications/${notifId}/status`, { status: "archived" });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (notif.status === "unread") {
      try {
        await markReadMutation.mutateAsync(notif.notification_id);
      } catch (e) {
        console.error("Failed to mark notification read:", e);
      }
    }

    // Role-aware context navigation
    if (notif.reference_type === "report" && notif.reference_id) {
      router.push(`/driver/reports?id=${notif.reference_id}`);
    } else if (notif.reference_type === "assignment") {
      router.push("/driver");
    } else if (notif.reference_type === "vehicle" && notif.reference_id) {
      router.push(`/mechanic/vehicles/${notif.reference_id}`);
    }
  };

  const filtered = notifications.filter((n) => filter === "all" || n.status === filter);
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500 font-mono">
        <RefreshCw size={24} className="animate-spin text-ferrari-red" />
        <p className="text-xs">Loading notifications feed…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load notifications</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch notification feed."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={13} /> Retry loading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-ferrari-red">
        <div>
          <div className="flex items-center gap-2 mb-1 font-mono text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-ferrari-red/10 px-2 py-0.5 text-ferrari-red border border-ferrari-red/30">
              <Bell size={12} /> {roleTitle} Notifications
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Notifications & Alerts</h1>
          <p className="text-xs text-slate-400 mt-1">
            System announcements, assignment changes, engineering alerts, and report updates.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-slate-300 rounded">
            Unread: <strong className="text-ferrari-red tabular-nums">{unreadCount}</strong>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {(["all", "unread", "read", "archived"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium capitalize transition-all ${
              filter === f ? "bg-slate-surface text-slate-100 font-semibold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f}
            {f === "all" && notifications.length > 0 && (
              <span className="ml-1.5 text-slate-600 font-mono">({notifications.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="border border-slate-800 bg-slate-surface p-12 text-center text-xs font-mono text-slate-500 rounded-xl">
            <Bell size={32} className="mx-auto mb-2 text-slate-600" />
            No {filter === "all" ? "" : filter} notifications found.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((notif) => {
              const isUnread = notif.status === "unread";
              return (
                <motion.div
                  key={notif.notification_id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-4 rounded-xl border p-4 transition-all cursor-pointer ${
                    isUnread
                      ? "border-ferrari-red/40 bg-ferrari-red/5 border-l-4 border-l-ferrari-red shadow-lg"
                      : "border-slate-800 bg-slate-surface hover:bg-slate-800/40 border-l-2 border-l-slate-700"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      isUnread
                        ? "border-ferrari-red/40 bg-ferrari-red/10 text-ferrari-red"
                        : "border-slate-800 bg-slate-900 text-slate-500"
                    }`}
                  >
                    {notif.reference_type === "report" ? (
                      <FileText size={16} />
                    ) : notif.reference_type === "assignment" ? (
                      <UserCheck size={16} />
                    ) : notif.reference_type === "vehicle" ? (
                      <Wrench size={16} />
                    ) : (
                      <Bell size={16} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100 truncate">{notif.title}</p>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
                          STATUS_STYLES[notif.status] ?? STATUS_STYLES.read
                        }`}
                      >
                        {notif.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-mono">{notif.message}</p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-mono">
                      <span>{formatRelative(notif.created_at)}</span>
                      {notif.reference_type && (
                        <span className="text-cyan-400 flex items-center gap-1">
                          Ref: {notif.reference_type} <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                  </div>

                  {notif.status !== "archived" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveMutation.mutate(notif.notification_id);
                      }}
                      title="Archive"
                      className="shrink-0 rounded-md p-1.5 text-slate-600 hover:bg-slate-800 hover:text-slate-300 transition-all"
                    >
                      <Archive size={14} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
