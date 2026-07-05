"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // مخبيش الـ Sidebar في صفحة اللوجين
  const hideSidebar = pathname === "/login";

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="mr-72 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}