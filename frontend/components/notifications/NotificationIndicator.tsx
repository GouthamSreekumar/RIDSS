"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import apiClient from "@/lib/axios";

interface UnreadCountResponse {
  unread_count: number;
}

export function NotificationIndicator({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data } = useQuery<UnreadCountResponse>({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const res = await apiClient.get<UnreadCountResponse>("/api/v1/notifications/unread-count");
      return res.data;
    },
    refetchInterval: 30000, // 30 seconds lightweight polling
    staleTime: 10000,
  });

  const unreadCount = data?.unread_count ?? 0;

  // Resolve role prefix for navigation
  const rolePrefix = pathname.split("/")[1] || "driver";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/${rolePrefix}/notifications`);
  };

  return (
    <button
      onClick={handleClick}
      title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      className={`relative inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors ${className}`}
    >
      <Bell size={16} className={unreadCount > 0 ? "text-slate-200" : "text-slate-400"} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-ferrari-red px-1 text-[10px] font-extrabold text-white ring-1 ring-ferrari-red/60 shadow-sm tabular-nums animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
