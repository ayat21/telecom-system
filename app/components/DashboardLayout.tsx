"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import {
  LayoutDashboard, PhoneCall, PlusCircle,
  FileSpreadsheet, Menu, X,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const bottomNav = [
    { name: "الرئيسية", href: "/", icon: LayoutDashboard },
    { name: "الخطوط", href: "/lines", icon: PhoneCall },
    { name: "إضافة", href: "/lines/new", icon: PlusCircle },
    { name: "استيراد", href: "/import", icon: FileSpreadsheet },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold">سيستم اتصالات تيليكوم</h1>
        <button onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 flex items-center justify-center bg-slate-800 rounded-xl">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-72 h-full bg-slate-900">
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-white">
              <X className="w-4 h-4" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`
        transition-all duration-300
        md:mr-72
        pt-14 md:pt-0
        pb-20 md:pb-0
      `}>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-2 py-2">
        <div className="flex items-center justify-around">
          {bottomNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition ${
                  isActive ? "text-blue-600" : "text-slate-400"
                }`}>
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}