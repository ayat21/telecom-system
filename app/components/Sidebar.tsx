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
  FileSpreadsheet,
  Users,
  Network,
  ShieldCheck,
  Activity,
  ChevronsRight,
  ChevronsLeft,
  LogOut,
  FileText,
  Building2,
  BarChart2,
  Percent,
  Upload,
  CreditCard,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  "الرئيسية":            LayoutDashboard,
  "الخطوط":              PhoneCall,
  "إضافة خط":            PlusCircle,
  "الباقات والخدمات":    Package,
  "استيراد Excel":       Upload,
  "الكشوفات Excel":      FileText,
  "العملاء":             Users,
  "الحالات":             Activity,
    "تقرير المبيعات":             Activity,
  "تقرير ارقام الحساب":  CreditCard,
  "تقريرالعموله":        Percent,
  "الاقسام والمنافذ":    Building2,
  "إدارة المستخدمين":    ShieldCheck,
};

function getMenuIcon(name: string): React.ElementType {
  return iconMap[name] || LayoutDashboard;
}

export default function Sidebar() {
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
    ...(role !== "viewer" ? [{ name: "الكشوفات Excel", href: "/collection" }] : []),
    ...(role !== "viewer" ? [{ name: "العملاء", href: "/clients" }] : []),
    ...(role !== "viewer" ? [{ name: "الحالات", href: "/status" }] : []),
    ...(role !== "viewer" ? [{ name: "تقرير ارقام الحساب", href: "/reports/accounts" }] : []),
    ...(role !== "viewer" ? [{ name: "تقريرالعموله", href: "/reports/commession" }] : []),
     ...(role !== "viewer" ? [{ name: "تقريرالمبيعات", href: "/reports/sales" }] : []),
    ...(role !== "viewer" ? [{ name: "الاقسام والمنافذ", href: "/manafiz" }] : []),
    ...(role === "super_admin" ? [{ name: "إدارة المستخدمين", href: "/users" }] : []),
  ];

  return (
    <aside className={`fixed right-0 top-0 h-screen bg-slate-900 text-white shadow-xl transition-all duration-300 z-50 flex flex-col ${collapsed ? "w-20" : "w-72"}`}>

      <div className="p-5 border-b border-slate-800">
        {!collapsed && (
          <>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                <Network className="w-[18px] h-[18px] text-white" />
              </span>
              <h1 className="text-lg font-bold leading-tight">سيستم اتصالات تيليكوم</h1>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              إدارة الخطوط • المبيعات • الباقات • التقارير
            </p>
            <div className="mt-3 bg-slate-800/70 rounded-xl p-3 border border-slate-700/50">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
        {fullName?.charAt(0) || "?"}
      </span>
      <p className="font-medium text-xs truncate text-slate-200">{fullName}</p>
    </div>
    <button onClick={handleLogout}
      title="تسجيل الخروج"
      className="shrink-0 w-7 h-7 flex items-center justify-center bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors mr-1">
      <LogOut className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
          </>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="mt-4 w-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 p-2.5 rounded-lg transition-colors"
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
              title={collapsed ? item.name : undefined}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors relative ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } ${collapsed ? "justify-center" : ""}`}>
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
  );
}