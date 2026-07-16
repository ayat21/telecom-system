"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Bell, Settings, LogOut, CheckCheck, Loader2, Menu,
  CalendarClock, AlertTriangle, Flame, CheckCircle2, Info, ClipboardList,
} from "lucide-react";
import {
  fetchNotifications, fetchUnreadCount,
  markNotificationRead, markAllNotificationsRead,
  NotificationRow,
} from "@/lib/notificationService";

const KIND_META: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  due_today:     { icon: CalendarClock, bg: "bg-blue-50",   color: "text-blue-600" },
  due_tomorrow:  { icon: CalendarClock, bg: "bg-indigo-50", color: "text-indigo-600" },
  overdue:       { icon: AlertTriangle, bg: "bg-red-50",    color: "text-red-600" },
  high_priority: { icon: Flame,         bg: "bg-orange-50", color: "text-orange-600" },
  completed:     { icon: CheckCircle2,  bg: "bg-green-50",  color: "text-green-600" },
  general:       { icon: Info,          bg: "bg-slate-100", color: "text-slate-600" },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير النظام",
  admin: "مسؤول",
  viewer: "مشاهدة فقط",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

export default function TopNavbar({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFullName(localStorage.getItem("full_name") || "");
    setRole(localStorage.getItem("role") || "");
  }, []);

  // ─── عداد غير المقروء: تحميل أولي + تحديث دوري ───────────────
  useEffect(() => {
    let mounted = true;
    async function refreshCount() {
      const count = await fetchUnreadCount();
      if (mounted) setUnreadCount(count);
    }
    refreshCount();
    const interval = setInterval(refreshCount, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ─── قفل الدروب داون عند الضغط برة ───────────────────────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggleNotifications() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening) {
      setLoadingNotifs(true);
      setNotifications(await fetchNotifications(20));
      setLoadingNotifs(false);
    }
  }

  async function onNotificationClick(n: NotificationRow) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifOpen(false);
    router.push(n.action_id ? `/actions?highlight=${n.action_id}` : "/actions");
  }

  async function onMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("role");
    localStorage.removeItem("full_name");
    localStorage.removeItem("user_id");
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 h-16 gap-2">

        {/* زرار فتح القائمة — موبايل/تابلت بس */}
        <button onClick={onOpenMobileMenu}
          className="lg:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition text-slate-600"
          title="فتح القائمة">
          <Menu className="w-5 h-5" />
        </button>

        {/* المستخدم */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shrink-0">
            {fullName?.charAt(0) || "?"}
          </span>
          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold text-slate-900 truncate">{fullName || "—"}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role] || role || "—"}</p>
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

          {/* الإشعارات */}
          <div className="relative" ref={notifRef}>
            <button onClick={toggleNotifications}
              title="الإشعارات"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition text-slate-600">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="fixed sm:absolute top-[4.5rem] sm:top-auto left-3 right-3 sm:left-0 sm:right-auto sm:mt-2 sm:w-96 max-w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">الإشعارات</p>
                  {unreadCount > 0 && (
                    <button onClick={onMarkAllRead}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition">
                      <CheckCheck className="w-3.5 h-3.5" /> تعليم الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loadingNotifs ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                      <Bell className="w-8 h-8 text-slate-200" />
                      <p className="text-sm">لا توجد إشعارات</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const meta = KIND_META[n.kind] || KIND_META.general;
                      const Icon = meta.icon;
                      return (
                        <button key={n.id} onClick={() => onNotificationClick(n)}
                          className={`w-full text-right flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition hover:bg-slate-50 ${
                            !n.is_read ? "bg-blue-50/60" : ""
                          }`}>
                          <span className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className={`w-4.5 h-4.5 ${meta.color}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className={`text-sm truncate ${!n.is_read ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                                {n.title}
                              </span>
                              {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                            </span>
                            {n.description && (
                              <span className="block text-xs text-slate-500 truncate mt-0.5">{n.description}</span>
                            )}
                            <span className="block text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <Link href="/actions" onClick={() => setNotifOpen(false)}
                  className="block text-center text-xs font-medium text-blue-600 hover:bg-slate-50 py-2.5 border-t border-slate-100 transition">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" />عرض كل الاجراءات
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* الإعدادات */}
          <Link href={role === "super_admin" ? "/users" : "/"}
            title="الإعدادات"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition text-slate-600">
            <Settings className="w-5 h-5" />
          </Link>

          {/* تسجيل الخروج */}
          <button onClick={handleLogout}
            title="تسجيل الخروج"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 hover:text-red-600 transition text-slate-600">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
