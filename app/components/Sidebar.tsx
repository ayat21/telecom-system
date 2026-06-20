"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  ...(role !== "viewer"
    ? [{ name: "إضافة خط", href: "/lines/new" }]
    : []),

  { name: "الباقات والخدمات", href: "/packages" },

  ...(role !== "viewer"
    ? [{ name: "استيراد Excel", href: "/import" }]
    : []),

  ...(role !== "viewer"
    ? [{ name: "الأقسام", href: "/departments" }]
    : []),

  ...(role !== "viewer"
    ? [{ name: "المنافذ", href: "/almanafiz" }]
    : []),

  ...(role === "super_admin"
    ? [{ name: "إدارة المستخدمين", href: "/users" }]
    : []),
];

  return (
    <aside
      className={`fixed right-0 top-0 h-screen bg-slate-900 text-white shadow-xl transition-all duration-300 z-50 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      {" "}
      <div className="p-5 border-b border-slate-700">
        {!collapsed && (
          <>
            <h1 className="text-xl font-bold">منصة إدارة الاتصالات</h1>

            <p className="text-xs text-slate-400 mt-1">
              إدارة الخطوط • المبيعات • الباقات • التقارير
            </p>

            <div className="mt-4 bg-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs">مرحباً</p>

              <p className="font-bold text-sm mt-1">{fullName}</p>

              <button
                onClick={handleLogout}
                className="mt-3 w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm"
              >
                تسجيل الخروج
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 w-full bg-slate-800 hover:bg-slate-700 p-2 rounded-lg"
        >
          ☰
        </button>
      </div>
      <div className="p-3 space-y-2">
        {menu.map((item) => {
          if (item.href === "/users" && role !== "super_admin") {
            return null;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-xl px-4 py-3 transition ${
                pathname === item.href ? "bg-blue-600" : "hover:bg-slate-800"
              }`}
            >
              {!collapsed && item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
