"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [hasRole, setHasRole] = useState(false);

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

  if (!checked) return null; // منع أي فلاش لحد ما نتأكد

  if (hideSidebar) {
    return <>{children}</>;
  }

  if (!hasRole) return null; // بيتحول للوجين، منعرضش حاجة

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Sidebar />
      <main className="mr-72 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}