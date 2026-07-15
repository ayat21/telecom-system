import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// ─── نفس الأقسام المستبعدة في شاشة المدفوعات ───
const EXCLUDED_DEPARTMENTS = ["SPOC", "فوري", "العهدة", "هيثم"];

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

interface DeptStat {
  name: string;
  required: number;
  collected: number;
  rate: number;
}

// ─── نفس منطق شاشة المدفوعات بالظبط (loadScopedLines + loadStatsAndScope) لكل قسم ───
async function buildCollectionImage(): Promise<ArrayBuffer> {
  const supabase = getSupabase();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1) هاتي كل الخطوط النشطة المرتبطة بقسم (بدون الأقسام المستبعدة)، مع اسم القسم والسعر
  const deptLineNumbers = new Map<string, Set<string>>(); // deptName -> line numbers
  const deptRequired = new Map<string, number>();

  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("lines")
      .select("number, total_price, departments(name)")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .not("department_id", "is", null)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;

    data.forEach((l: any) => {
      const deptName = l.departments?.name;
      if (!deptName || EXCLUDED_DEPARTMENTS.includes(deptName)) return;
      if (!deptLineNumbers.has(deptName)) {
        deptLineNumbers.set(deptName, new Set());
        deptRequired.set(deptName, 0);
      }
      deptLineNumbers.get(deptName)!.add(l.number);
      deptRequired.set(deptName, (deptRequired.get(deptName) || 0) + (l.total_price || 0));
    });

    if (data.length < 1000) break;
    offset += 1000;
  }

  // 2) هاتي كل السدادات (كل الوقت، زي منطق شاشة المدفوعات) واجمعيها لكل رقم خط
  const paidAmountByLine = new Map<string, number>();
  let pOffset = 0;
  while (true) {
    const { data } = await supabase
      .from("payments")
      .select("line_number, amount")
      .range(pOffset, pOffset + 999);
    if (!data || data.length === 0) break;
    data.forEach((p: any) => {
      paidAmountByLine.set(p.line_number, (paidAmountByLine.get(p.line_number) || 0) + (p.amount || 0));
    });
    if (data.length < 1000) break;
    pOffset += 1000;
  }

  // 3) اجمعي المحصل لكل قسم من أرقامه بس
  const stats: DeptStat[] = [];
  deptLineNumbers.forEach((numbers, deptName) => {
    let collected = 0;
    numbers.forEach((num) => {
      collected += paidAmountByLine.get(num) || 0;
    });
    const required = deptRequired.get(deptName) || 0;
    const rate = required > 0 ? Math.round((collected / required) * 100) : 0;
    stats.push({ name: deptName, required, collected, rate });
  });

  stats.sort((a, b) => b.required - a.required);

  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const fontData = await loadArabicFont();

  const height = 300 + Math.ceil(stats.length / 3) * 150;

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "900px",
          height: `${height}px`,
          background: "linear-gradient(135deg, #059669, #047857)",
          padding: "40px",
          fontFamily: "Cairo",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
          <div style={{ color: "#d1fae5", fontSize: 20 }}>{dateLabel}</div>
          <div style={{ color: "#ffffff", fontSize: 38, fontWeight: 700, marginTop: 4 }}>
            تقرير نسبة السداد لكل قسم
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {stats.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.15)",
                borderRadius: "20px",
                width: "270px",
                padding: "18px",
              }}
            >
              <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>{s.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
                <div style={{ color: "#ffffff", fontSize: 44, fontWeight: 700 }}>{s.rate}</div>
                <div style={{ color: "#d1fae5", fontSize: 20, marginRight: 4 }}>%</div>
              </div>
              <div style={{ color: "#d1fae5", fontSize: 15, marginTop: 6 }}>
                محصل {s.collected.toLocaleString()} / مطلوب {s.required.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 900,
      height,
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
    const imageBuffer = await buildCollectionImage();
    const result = await sendTelegramPhoto(
      process.env.TELEGRAM_CHAT_ID_COLLECTION!,
      imageBuffer,
      "💰 تقرير نسبة السداد لكل قسم"
    );
    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}