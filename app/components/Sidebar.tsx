"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  PhoneCall,
  PlusCircle,
  Package,
  FileText,
  Users,
  Network,
  ShieldCheck,
  ListChecks,
  ChevronsRight,
  ChevronsLeft,
  LogOut,
  Building2,
  Percent,
  Upload,
  CreditCard,
  Search,
  Wallet,
  TrendingUp,
  FileBarChart2,
  ClipboardList,
  X,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  "الرئيسية":              LayoutDashboard,
  "الخطوط":                PhoneCall,
  "إضافة خط":              PlusCircle,
  "الباقات والخدمات":      Package,
  "استيراد Excel":         Upload,
  "الكشوفات":              FileText,
  "العملاء":               Users,
  "الحالات":               ListChecks,
  "الأكشنات":              ClipboardList,
  "التحصيل":               Wallet,
  "البحث":                 Search,
  "المدفوعات":             CreditCard,
  "تقرير المبيعات":        TrendingUp,
  "تقرير ارقام الحساب":    FileBarChart2,
  "تقريرالعموله":          Percent,
   "حساب المنافذ":          Percent,
  "الاقسام والمنافذ":      Building2,
  "إدارة المستخدمين":      ShieldCheck,
};

function getMenuIcon(name: string): React.ElementType {
  return iconMap[name] || LayoutDashboard;
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
    setFullName(localStorage.getItem("full_name") || "");
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem("role");
    localStorage.removeItem("full_name");
    window.location.href = "/login";
  }

  const menu = [
    { name: "الرئيسية", href: "/" },
    { name: "الخطوط", href: "/lines" },
    ...(role !== "viewer" ? [{ name: "إضافة خط", href: "/lines/new" }] : []),
    { name: "الباقات والخدمات", href: "/packages" },
    ...(role !== "viewer" ? [{ name: "استيراد Excel", href: "/import" }] : []),
    ...(role !== "viewer" ? [{ name: "الكشوفات", href: "/kshofat" }] : []),
    ...(role !== "viewer" ? [{ name: "العملاء", href: "/clients" }] : []),
    ...(role !== "viewer" ? [{ name: "المدفوعات", href: "/payments" }] : []),
    ...(role !== "viewer" ? [{ name: "البحث", href: "/search" }] : []),
    ...(role !== "viewer" ? [{ name: "الحالات", href: "/status" }] : []),
    ...(role !== "viewer" ? [{ name: "الأكشنات", href: "/actions" }] : []),
    ...(role !== "viewer" ? [{ name: "حساب المنافذ", href: "/reports/manafiz-account" }] : []),
    ...(role !== "viewer" ? [{ name: "التحصيل", href: "/collection" }] : []),
    ...(role !== "viewer" ? [{ name: "تقرير ارقام الحساب", href: "/reports/accounts" }] : []),
    ...(role !== "viewer" ? [{ name: "تقريرالعموله", href: "/reports/commession" }] : []),
    ...(role !== "viewer" ? [{ name: "تقرير المبيعات", href: "/reports/sales" }] : []),
    ...(role !== "viewer" ? [{ name: "الاقسام والمنافذ", href: "/manafiz" }] : []),
    ...(role === "super_admin" ? [{ name: "إدارة المستخدمين", href: "/users" }] : []),
  ];

  return (
    <>
      {/* خلفية شفافة تقفل الدروار على الموبايل/التابلت */}
      {mobileOpen && (
        <div onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      <aside className={`fixed top-0 h-screen bg-slate-900 text-white shadow-xl transition-[right] lg:transition-all duration-300 z-50 flex flex-col w-72 ${
        collapsed ? "lg:w-20" : "lg:w-72"
      } ${mobileOpen ? "right-0" : "-right-72"} lg:right-0`}>

        <div className="p-5 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-2.5 justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                  <Network className="w-[18px] h-[18px] text-white" />
                </span>
                <h1 className="text-lg font-bold leading-tight truncate">سيستم اتصالات تيليكوم</h1>
              </div>
              {/* زرار قفل الدروار — الموبايل/التابلت بس */}
              <button onClick={onCloseMobile}
                className="lg:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                title="إغلاق القائمة">
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          )}
          {!collapsed && (
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              إدارة الخطوط • المبيعات • الباقات • التقارير
            </p>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex mt-4 w-full items-center justify-center bg-slate-800 hover:bg-slate-700 p-2.5 rounded-lg transition-colors"
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}>
            {collapsed
              ? <ChevronsLeft className="w-4 h-4 text-slate-300" />
              : <ChevronsRight className="w-4 h-4 text-slate-300" />}
          </button>
        </div>

        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          {menu.map((item) => {
            if (item.href === "/users" && role !== "super_admin") return null;
            const Icon = getMenuIcon(item.name);
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? item.name : undefined}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors relative ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                } ${collapsed ? "lg:justify-center" : ""}`}>
                {isActive && !collapsed && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-full" />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
                {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}