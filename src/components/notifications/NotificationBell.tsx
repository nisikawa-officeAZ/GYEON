"use client";

import { useState, useEffect, useRef } from "react";
import { getNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/notifications/notification";
import type { NotificationDB } from "@/lib/notifications/notification-types";
import { notificationTypeIcon, notificationTypeColor } from "@/lib/notifications/notification-types";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return iso.slice(0, 10);
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDB[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchData() {
    const [count, notifs] = await Promise.all([
      getUnreadNotificationCount(),
      getNotifications(),
    ]);
    setUnreadCount(count);
    setNotifications(notifs);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationAsRead(id);
    await fetchData();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsAsRead();
    await fetchData();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        aria-label="通知"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a5 5 0 0 0-5 5v2.586l-.707.707A1 1 0 0 0 3 11h10a1 1 0 0 0 .707-1.707L13 8.586V6a5 5 0 0 0-5-5zM8 15a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-h-96 bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
            <span className="text-sm font-semibold text-slate-100">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                すべて既読
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-slate-500">
                通知はありません
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors ${
                    n.is_read ? "bg-[#0f172a]/50" : "bg-[#1e293b]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`text-base leading-none mt-0.5 shrink-0 ${notificationTypeColor(n.type)}`}>
                      {notificationTypeIcon(n.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-100 truncate">{n.title}</span>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.message}</p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
