import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MIGRATION_DEPT_ID = 10;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function buildSalesImage(): Promise<ArrayBuffer> {
  const supabase = getSupabase();

  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: lines } = await supabase
    .from("lines")
    .select("department_id")
    .eq("customer_date_real", todayStr)
    .or("is_deleted.is.null,is_deleted.eq.false");

  const rows = lines || [];
  const migration = rows.filter((l: any) => l.department_id === MIGRATION_DEPT_ID).length;
  const sales = rows.filter((l: any) => l.department_id && l.department_id !== MIGRATION_DEPT_ID).length;
  const total = sales + migration;

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "800px",
          height: "500px",
          background: "linear-gradient(135deg, #2563eb, #1e40af)",
          padding: "40px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "30px" }}>
          <div style={{ color: "#dbeafe", fontSize: 22 }}>{dateLabel}</div>
          <div style={{ color: "#ffffff", fontSize: 40, fontWeight: 700, marginTop: 4 }}>
            تقرير المبيعات اليومي
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "24px",
              flex: 1,
              padding: "20px",
            }}
          >
            <div style={{ color: "#bbf7d0", fontSize: 22 }}>مبيعات</div>
            <div style={{ color: "#ffffff", fontSize: 64, fontWeight: 700 }}>{sales}</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "24px",
              flex: 1,
              padding: "20px",
            }}
          >
            <div style={{ color: "#fed7aa", fontSize: 22 }}>مايجريشن</div>
            <div style={{ color: "#ffffff", fontSize: 64, fontWeight: 700 }}>{migration}</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(255,255,255,0.25)",
              borderRadius: "24px",
              flex: 1,
              padding: "20px",
            }}
          >
            <div style={{ color: "#e0e7ff", fontSize: 22 }}>الإجمالي</div>
            <div style={{ color: "#ffffff", fontSize: 64, fontWeight: 700 }}>{total}</div>
          </div>
        </div>
      </div>
    ),
    { width: 800, height: 500 }
  );

  return await image.arrayBuffer();
}

async function sendTelegramPhoto(chatId: string, imageBuffer: ArrayBuffer, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append("photo", new Blob([imageBuffer], { type: "image/png" }), "report.png");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  // تأمين الـ endpoint — Vercel Cron بيبعت الهيدر ده تلقائي لو CRON_SECRET متظبط
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const imageBuffer = await buildSalesImage();
    const result = await sendTelegramPhoto(
      process.env.TELEGRAM_CHAT_ID_SALES!,
      imageBuffer,
      "📊 تقرير المبيعات اليومي"
    );
    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
