"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function DashboardLayout({
children,
}: {
children: React.ReactNode;
}) {
const pathname = usePathname();

if (pathname === "/login") {
return <>{children}</>;
}

return (
<> <Sidebar />

  <main className="pr-72 min-h-screen bg-slate-100">
    {children}
  </main>
</>

);
}
