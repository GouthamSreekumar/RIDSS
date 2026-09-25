"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import axiosInstance from "@/lib/axios";
import { FastF1LoadingSkeleton } from "@/components/race-engineer/FastF1LoadingSkeleton";

interface NotificationItem {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  status: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await axiosInstance.get("/api/v1/driver/notifications");
  return res.data;
}

export default function DriverNotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, isError, error, refetch } = useQuery<NotificationItem[]>({
    queryKey: ["driverNotifications"],
    queryFn: fetchNotifications,
    staleTime: 30 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await axiosInstance.patch(`/api/v1/driver/notifications/${notificationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driverNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["driverDashboard"] });
    },
  });

  const handleNotificationClick = async (notif: NotificationItem) => {
    // 1. Mark notification read if unread
    if (notif.status === "unread") {
      try {
        await markReadMutation.mutateAsync(notif.notification_id);
      } catch (e) {
        console.error("Failed to mark notification read:", e);
      }
    }

    // 2. Deep-link if reference is available
    if (notif.reference_type === "report" && notif.reference_id) {
      router.push(`/driver/reports?id=${notif.reference_id}`);
    } else if (notif.reference_type === "assignment") {
      router.push("/driver");
    }
  };

  const unreadCount = (notifications || []).filter((n) => n.status === "unread").length;

  if (isLoading) {
    return (
      <FastF1LoadingSkeleton
        title="Loading Cockpit Alerts"
        message="Fetching notifications and assignment updates..."
      />
    );
  }

  if (isError) {
    return (
      <div className="border border-red-500/30 bg-red-950/20 p-8 text-center text-red-400 border-l-2 border-l-red-500 font-sans">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="text-base font-bold">Failed to load notifications</h3>
        <p className="text-xs mt-1 text-red-300/80 mb-4 font-mono">
          {error instanceof Error ? error.message : "Unable to fetch driver notification records."}
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
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 bg-slate-surface p-5 border-l-2 border-l-amber">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="sharp-tag bg-amber/10 text-amber border border-amber/30">
              <Bell size={12} className="text-amber mr-1" /> Cockpit notifications
            </span>
            <span className="text-xs text-slate-400">• Personal driver alert feed</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Notifications & alerts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Performance report releases, vehicle assignment updates, and engineering notices.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
            Unread: <strong className="text-amber tabular-nums">{unreadCount}</strong>
          </span>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {(notifications || []).length === 0 ? (
          <div className="border border-slate-800 bg-slate-surface p-12 text-center text-xs font-mono text-slate-400">
            No notifications found in your cockpit feed.
          </div>
        ) : (
          (notifications || []).map((notif) => {
            const isUnread = notif.status === "unread";
            return (
              <div
                key={notif.notification_id}
                onClick={() => handleNotificationClick(notif)}
                className={`border p-4 transition-all cursor-pointer group ${
                  isUnread
                    ? "border-amber/50 bg-amber/5 border-l-4 border-l-amber shadow-lg"
                    : "border-slate-800 bg-slate-surface hover:bg-slate-900/60 border-l-2 border-l-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 border mt-0.5 shrink-0 ${
                        isUnread
                          ? "border-amber/40 bg-amber/10 text-amber"
                          : "border-slate-800 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {notif.reference_type === "report" ? (
                        <FileText size={16} />
                      ) : notif.reference_type === "assignment" ? (
                        <UserCheck size={16} />
                      ) : (
                        <Bell size={16} />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`sharp-tag text-[10px] font-mono ${
                            isUnread
                              ? "bg-amber/20 text-amber border border-amber/40 font-bold"
                              : "bg-slate-900 text-slate-400 border border-slate-800"
                          }`}
                        >
                          {isUnread ? "UNREAD ALERT" : "READ"}
                        </span>
                        {notif.reference_type && (
                          <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">
                            Ref: {notif.reference_type}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber transition-colors">
                        {notif.title}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {new Date(notif.created_at).toLocaleDateString()}{" "}
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {notif.reference_id && (
                      <span className="text-[11px] font-mono text-cyan-400 group-hover:underline flex items-center gap-1">
                        View context <ExternalLink size={11} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
