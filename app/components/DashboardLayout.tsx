"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [hasRole, setHasRole] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar_collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  const hideSidebar = pathname === "/login";

  useEffect(() => {
    if (hideSidebar) {
      setChecked(true);
      return;
    }
    const role = localStorage.getItem("role");
    if (!role) {
      router.replace("/login");
      return;
    }
    setHasRole(true);
    setChecked(true);
  }, [pathname]);

  // اقفلي الدروار عند تغيير الصفحة (موبايل/تابلت)
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!checked) return null; // منع أي فلاش لحد ما نتأكد

  if (hideSidebar) {
    return <>{children}</>;
  }

  if (!hasRole) return null; // بيتحول للوجين، منعرضش حاجة

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <div className={`mr-0 transition-all duration-300 min-w-0 ${collapsed ? "lg:mr-20" : "lg:mr-72"}`}>
        <TopNavbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}