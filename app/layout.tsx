import "./globals.css";
import DashboardLayout from "@/app/components/DashboardLayout";
import SortableTablesClient from "@/app/components/SortableTablesClient";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar">
      <body dir="rtl">
        <DashboardLayout>
          <SortableTablesClient />
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}