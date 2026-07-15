import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function buildCollectionImage(): Promise<ArrayBuffer> {
  const supabase = getSupabase();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // إجمالي المطلوب (كل الخطوط المرتبطة بقسم، من غير الأقسام المستبعدة)
  const EXCLUDED = ["SPOC", "فوري", "العهدة", "هيثم"];
  let requiredTotal = 0;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("lines")
      .select("total_price, departments(name)")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .not("department_id", "is", null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    data.forEach((l: any) => {
      if (!EXCLUDED.includes(l.departments?.name || "")) requiredTotal += l.total_price || 0;
    });
    if (data.length < 1000) break;
    offset += 1000;
  }

  // إجمالي المحصل لشهر النهارده
  let collectedTotal = 0;
  let pOffset = 0;
  while (true) {
    const { data } = await supabase
      .from("payments")
      .select("amount")
      .eq("payment_month", currentMonth)
      .range(pOffset, pOffset + 999);
    if (!data || data.length === 0) break;
    collectedTotal += data.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    if (data.length < 1000) break;
    pOffset += 1000;
  }

  const rate = requiredTotal > 0 ? Math.round((collectedTotal / requiredTotal) * 100) : 0;
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "800px",
          height: "500px",
          background: "linear-gradient(135deg, #059669, #047857)",
          padding: "40px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "30px" }}>
          <div style={{ color: "#d1fae5", fontSize: 22 }}>{dateLabel}</div>
          <div style={{ color: "#ffffff", fontSize: 40, fontWeight: 700, marginTop: 4 }}>
            تقرير نسبة السداد
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ color: "#ffffff", fontSize: 110, fontWeight: 700 }}>{rate}%</div>
          <div style={{ color: "#d1fae5", fontSize: 22, marginTop: 10 }}>نسبة التحصيل الحالية</div>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "20px",
              flex: 1,
              padding: "18px",
            }}
          >
            <div style={{ color: "#d1fae5", fontSize: 18 }}>إجمالي المطلوب</div>
            <div style={{ color: "#ffffff", fontSize: 32, fontWeight: 700 }}>{requiredTotal.toLocaleString()}</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "20px",
              flex: 1,
              padding: "18px",
            }}
          >
            <div style={{ color: "#d1fae5", fontSize: 18 }}>إجمالي المحصل</div>
            <div style={{ color: "#ffffff", fontSize: 32, fontWeight: 700 }}>{collectedTotal.toLocaleString()}</div>
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
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const imageBuffer = await buildCollectionImage();
    const result = await sendTelegramPhoto(
      process.env.TELEGRAM_CHAT_ID_COLLECTION!,
      imageBuffer,
      "💰 تقرير نسبة السداد اليومي"
    );
    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
