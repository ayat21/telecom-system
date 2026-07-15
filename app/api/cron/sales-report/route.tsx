import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MIGRATION_DEPT_ID = 10;

// ─── غيّري التاريخ ده لأي تاريخ عايزة التقرير يبدأ منه ───
const START_DATE = "2026-01-01";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function loadArabicFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-a1M.ttf"
  );
  return await res.arrayBuffer();
}

// ─── نفس منطق شاشة "تقرير المبيعات" بالظبط (department_id) ───
async function buildSalesImage(): Promise<ArrayBuffer> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("lines")
    .select("department_id")
    .gte("customer_date_real", START_DATE)
    .lte("customer_date_real", today)
    .or("is_deleted.is.null,is_deleted.eq.false");

  const rows = data || [];
  const migration = rows.filter((l: any) => l.department_id === MIGRATION_DEPT_ID).length;
  const sales = rows.filter((l: any) => l.department_id && l.department_id !== MIGRATION_DEPT_ID).length;
  const total = sales + migration;

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const [sy, sm, sd] = START_DATE.split("-");
  const startLabel = `${sd}/${sm}/${sy}`;

  const fontData = await loadArabicFont();

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
          fontFamily: "Cairo",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
          <div style={{ color: "#dbeafe", fontSize: 20 }}>
            من {startLabel} — تقرير بتاريخ {dateLabel}
          </div>
          <div style={{ color: "#ffffff", fontSize: 38, fontWeight: 700, marginTop: 4 }}>
            تقرير المبيعات
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
            <div style={{ color: "#ffffff", fontSize: 62, fontWeight: 700 }}>{sales}</div>
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
            <div style={{ color: "#ffffff", fontSize: 62, fontWeight: 700 }}>{migration}</div>
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
            <div style={{ color: "#ffffff", fontSize: 62, fontWeight: 700 }}>{total}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 500,
      fonts: [{ name: "Cairo", data: fontData, style: "normal", weight: 400 }],
    }
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
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const imageBuffer = await buildSalesImage();
    const result = await sendTelegramPhoto(
      process.env.TELEGRAM_CHAT_ID_SALES!,
      imageBuffer,
      "📊 تقرير المبيعات"
    );
    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}