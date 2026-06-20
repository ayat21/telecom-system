import "./globals.css";
import DashboardLayout from "@/app/components/DashboardLayout";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar">
      <body dir="rtl">
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}