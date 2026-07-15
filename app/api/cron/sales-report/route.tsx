import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 45;

const MIGRATION_DEPT_ID = 10;

// ─── غيّري التاريخ ده لأي تاريخ عايزة التقرير يبدأ منه ───
const START_DATE = "2026-06-28";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const NET_COLORS: Record<string, string> = {
  orange: "#ef4444",
  vodafone: "#f97316",
  etisalat: "#22c55e",
};

async function getFullSalesData() {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  // ─── إجمالي كل الخطوط (غير محذوفة) ───
  const { count: totalLinesCount } = await supabase
    .from("lines")
    .select("*", { count: "exact", head: true })
    .or("is_deleted.is.null,is_deleted.eq.false");

  // ─── الغير مباع الحالي (بدون فلتر تاريخ) ───
  const { count: unsoldCount } = await supabase
    .from("lines")
    .select("*", { count: "exact", head: true })
    .eq("is_deactive", true);

  // ─── خطوط الفترة المحددة (مبيعات + مايجريشن) مع تفاصيل ───
  const { data: periodLines } = await supabase
    .from("lines")
    .select("department_id, agent_id, provider_id, customer_date_real, agents(name), providers(name)")
    .gte("customer_date_real", START_DATE)
    .lte("customer_date_real", today)
    .not("department_id", "is", null)
    .or("is_deleted.is.null,is_deleted.eq.false");

  const rows = periodLines || [];
  const salesRows = rows.filter((l: any) => l.department_id !== MIGRATION_DEPT_ID);
  const migrationRows = rows.filter((l: any) => l.department_id === MIGRATION_DEPT_ID);

  const salesCount = salesRows.length;
  const migrationCount = migrationRows.length;
  const totalLines = totalLinesCount || 0;
  const unsold = unsoldCount || 0;

  const salesRate =  unsold > 0 ? ((salesCount / (salesCount + unsold)) * 100).toFixed(2) : 0;
  const migrationRate = totalLines > 0 ? ((migrationCount / totalLines) * 100).toFixed(2) : 0;
  const periodTotal = salesCount + migrationCount;

  // ─── توزيع المبيعات حسب الشبكة (من المبيعات بس) ───
  const networkMap = new Map<string, number>();
  salesRows.forEach((l: any) => {
    const name = (l.providers?.name || "غير محدد").toLowerCase();
    networkMap.set(name, (networkMap.get(name) || 0) + 1);
  });
  const networkStats = [...networkMap.entries()]
    .map(([name, count]) => ({ name, count, pct: salesCount > 0 ? (count / salesCount) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // ─── أفضل 10 مندوبين (مبيعات + مايجريشن مع بعض) ───
  const agentMap = new Map<string, number>();
  rows.forEach((l: any) => {
    const name = l.agents?.name || "بدون مندوب";
    agentMap.set(name, (agentMap.get(name) || 0) + 1);
  });
  const topAgents = [...agentMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ─── تفاصيل يومية (آخر 7 أيام في الفترة) ───
  const dailyMap = new Map<string, { sales: number; migration: number }>();
  rows.forEach((l: any) => {
    const d = l.customer_date_real;
    if (!d) return;
    if (!dailyMap.has(d)) dailyMap.set(d, { sales: 0, migration: 0 });
    const entry = dailyMap.get(d)!;
    if (l.department_id === MIGRATION_DEPT_ID) entry.migration++;
    else entry.sales++;
  });
  const dailyRows = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, ...v, total: v.sales + v.migration }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);

  return {
    totalLines, unsold, salesCount, migrationCount, periodTotal,
    salesRate, migrationRate, networkStats, topAgents, dailyRows,
  };
}

async function loadArabicFontBase64(): Promise<{ base64: string; format: string }> {
  const cssRes = await fetch(
    "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  );
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(woff2|truetype)'\)/);
  if (!match) throw new Error("مقدرش ألاقي رابط الخط");
  const fontRes = await fetch(match[1]);
  const buffer = await fontRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), format: match[2] };
}

function conicGradient(segments: { pct: number; color: string }[]): string {
  let acc = 0;
  const parts = segments.map((s) => {
    const start = acc;
    acc += s.pct;
    return `${s.color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

function buildHtml(data: Awaited<ReturnType<typeof getFullSalesData>>, font: { base64: string; format: string }) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const [sy, sm, sd] = START_DATE.split("-");
  const startLabel = `${sd}/${sm}/${sy}`;

  const networkSegments = data.networkStats.map((n) => ({
    pct: n.pct,
    color: NET_COLORS[n.name] || "#94a3b8",
  }));
  const networkDonut = conicGradient(networkSegments);

  const typeDonut = conicGradient([
    { pct: data.periodTotal > 0 ? (data.migrationCount / data.periodTotal) * 100 : 0, color: "#3b82f6" },
    { pct: data.periodTotal > 0 ? (data.salesCount / data.periodTotal) * 100 : 0, color: "#22c55e" },
  ]);

  const maxAgentCount = Math.max(1, ...data.topAgents.map((a) => a.count));

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <style>
        @font-face {
          font-family: 'ArFont';
          src: url(data:font/${font.format === "woff2" ? "woff2" : "truetype"};charset=utf-8;base64,${font.base64}) format('${font.format}');
        }
        * { margin:0; padding:0; box-sizing:border-box; font-family:'ArFont', Arial, sans-serif; }
        body { width: 1400px; background:#f8fafc; padding: 36px; direction: rtl; color:#1e293b; }
        .header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:24px; }
        .header h1 { font-size:34px; font-weight:700; }
        .header .sub { font-size:15px; color:#64748b; margin-top:4px; }
        .period { font-size:15px; color:#475569; background:white; padding:10px 18px; border-radius:12px; border:1px solid #e2e8f0; }

        .stats-row { display:flex; gap:16px; margin-bottom:24px; flex-wrap: wrap; }
        .stat-card { flex:1; min-width:200px; background:white; border-radius:16px; padding:20px; border:1px solid #e2e8f0; }
        .stat-label { font-size:14px; color:#64748b; }
        .stat-value { font-size:32px; font-weight:700; margin-top:10px; }
        .stat-note { font-size:12px; color:#94a3b8; margin-top:4px; }

        .panels-row { display:flex; gap:16px; margin-bottom:24px; }
        .panel { flex:1; background:white; border-radius:16px; padding:22px; border:1px solid #e2e8f0; }
        .panel h2 { font-size:18px; font-weight:700; margin-bottom:16px; }

        .donut-wrap { display:flex; flex-direction:column; align-items:center; }
        .donut { width:190px; height:190px; border-radius:50%; position:relative; }
        .donut-hole { position:absolute; inset:32px; background:white; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .donut-hole .num { font-size:26px; font-weight:700; }
        .donut-hole .lbl { font-size:12px; color:#64748b; }
        .legend { display:flex; gap:14px; margin-top:16px; flex-wrap:wrap; justify-content:center; }
        .legend-item { display:flex; align-items:center; gap:6px; font-size:13px; }
        .dot { width:10px; height:10px; border-radius:50%; }

        table { width:100%; border-collapse:collapse; font-size:14px; }
        th { text-align:right; color:#64748b; font-weight:600; padding:8px 6px; border-bottom:1px solid #e2e8f0; font-size:13px; }
        td { padding:9px 6px; border-bottom:1px solid #f1f5f9; }
        tr:last-child td { border-bottom:none; }

        .bars { display:flex; align-items:flex-end; gap:8px; height:150px; margin-top:10px; }
        .bar-col { display:flex; flex-direction:column; align-items:center; flex:1; }
        .bar { width:100%; background:#22c55e; border-radius:6px 6px 0 0; }
        .bar-name { font-size:10px; color:#64748b; margin-top:4px; text-align:center; word-break:break-word; max-width:60px; }

        .footer-note { text-align:center; font-size:12px; color:#94a3b8; margin-top:10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>📋 تقرير المبيعات</h1>
          <div class="sub">تحليل شامل لأداء المبيعات في الفترة المحددة</div>
        </div>
        <div class="period">من ${startLabel} — إلى ${dateLabel}</div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">إجمالي الخطوط (الكل)</div>
          <div class="stat-value">${data.totalLines.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">نسبة مايجريشن</div>
          <div class="stat-value" style="color:#ef4444;">${data.migrationRate.toFixed(2)}%</div>
          <div class="stat-note">من إجمالي الخطوط</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">نسبة المبيعات</div>
          <div class="stat-value" style="color:#7c3aed;">${data.salesRate.toFixed(2)}%</div>
          <div class="stat-note">من إجمالي (مبيعات + غير مباع)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">الغير مباع</div>
          <div class="stat-value" style="color:#ef4444;">${data.unsold.toLocaleString()}</div>
          <div class="stat-note">خط حالياً</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">إجمالي مايجريشن (الفترة)</div>
          <div class="stat-value" style="color:#f97316;">${data.migrationCount.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">إجمالي المبيعات (الفترة)</div>
          <div class="stat-value" style="color:#22c55e;">${data.salesCount.toLocaleString()}</div>
        </div>
      </div>

      <div class="panels-row">
        <div class="panel">
          <h2>توزيع المبيعات حسب الشبكة</h2>
          <div class="donut-wrap">
            <div class="donut" style="background:${networkDonut};">
              <div class="donut-hole"></div>
            </div>
            <div class="legend">
              ${data.networkStats.map((n) => `
                <div class="legend-item">
                  <span class="dot" style="background:${NET_COLORS[n.name] || "#94a3b8"};"></span>
                  ${n.name} (${n.pct.toFixed(1)}%)
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="panel">
          <h2>⭐ أفضل 10 مندوبين</h2>
          <table>
            <thead><tr><th>#</th><th>المندوب</th><th>المبيعات</th></tr></thead>
            <tbody>
              ${data.topAgents.map((a, i) => `<tr><td>${i + 1}</td><td>${a.name}</td><td><b>${a.count}</b></td></tr>`).join("")}
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2>مبيعات حسب المندوب</h2>
          <div class="bars">
            ${data.topAgents.map((a) => `
              <div class="bar-col">
                <div class="bar" style="height:${(a.count / maxAgentCount) * 130}px;"></div>
                <div class="bar-name">${a.name}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="panels-row">
        <div class="panel">
          <h2>📅 تفاصيل المبيعات اليومية</h2>
          <table>
            <thead><tr><th>التاريخ</th><th>مبيعات</th><th>مايجريشن</th><th>الإجمالي</th></tr></thead>
            <tbody>
              ${data.dailyRows.map((d) => `
                <tr><td>${d.date}</td><td style="color:#22c55e;">${d.sales}</td><td style="color:#3b82f6;">${d.migration}</td><td><b>${d.total}</b></td></tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2>تفاصيل المبيعات لكل نوع</h2>
          <table>
            <thead><tr><th>النوع</th><th>عدد الخطوط</th><th>النسبة</th></tr></thead>
            <tbody>
              <tr><td>🟢 مبيعات</td><td>${data.salesCount}</td><td>${data.salesRate.toFixed(2)}%</td></tr>
              <tr><td>🔵 مايجريشن</td><td>${data.migrationCount}</td><td>${data.migrationRate.toFixed(2)}%</td></tr>
              <tr style="background:#f8fafc;"><td><b>الإجمالي</b></td><td><b>${data.totalLines.toLocaleString()}</b></td><td><b>100%</b></td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2>نسبة المبيعات لكل نوع</h2>
          <div class="donut-wrap">
            <div class="donut" style="background:${typeDonut};">
              <div class="donut-hole">
                <div class="num">${data.periodTotal}</div>
                <div class="lbl">الإجمالي</div>
              </div>
            </div>
            <div class="legend">
              <div class="legend-item"><span class="dot" style="background:#22c55e;"></span>مبيعات (${data.salesCount} — ${(data.periodTotal > 0 ? (data.salesCount / data.periodTotal) * 100 : 0).toFixed(1)}%)</div>
              <div class="legend-item"><span class="dot" style="background:#3b82f6;"></span>مايجريشن (${data.migrationCount} — ${(data.periodTotal > 0 ? (data.migrationCount / data.periodTotal) * 100 : 0).toFixed(1)}%)</div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-note">تم إنشاء هذا التقرير تلقائياً بتاريخ ${dateLabel}</div>
    </body>
    </html>
  `;
}

async function renderImage(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `${path.dirname(executablePath)}:${process.env.LD_LIBRARY_PATH || ""}`;

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 800 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    // استني ثانية إضافية عشان الخطوط والتصميم يستقروا تماماً قبل التصوير
    await new Promise((r) => setTimeout(r, 500));

    // مهم: لو الـ viewport أطول من المحتوى الفعلي وبعدين عملنا screenshot({fullPage:true})
    // بيرجع صورة فاضية بيضاء (باج مؤكد في puppeteer/chromium هنا). الحل: نضبط ارتفاع
    // الـ viewport على الارتفاع الحقيقي للمحتوى بعد التحميل، وناخد screenshot عادي بعدها.
    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: 1400, height: contentHeight });

    const screenshot = await page.screenshot({ type: "png" });
    return screenshot as Buffer;
  } finally {
    await browser.close();
  }
}

async function sendTelegramPhoto(chatId: string, imageBuffer: Buffer, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append("photo", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "report.png");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

// ─── لو الصورة كبيرة جداً وتلجرام رفضها كصورة، ابعتيها كملف بدل كده ───
async function sendTelegramDocument(chatId: string, imageBuffer: Buffer, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append("document", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "report.png");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
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
    const data = await getFullSalesData();
    const font = await loadArabicFontBase64();
    const html = buildHtml(data, font);
    const imageBuffer = await renderImage(html);

    let result = await sendTelegramPhoto(process.env.TELEGRAM_CHAT_ID_SALES!, imageBuffer, "📊 تقرير المبيعات الكامل");

    // لو تلجرام رفض الصورة (كبيرة جداً كـ Photo)، ابعتيها كملف
    if (!result.ok) {
      result = await sendTelegramDocument(process.env.TELEGRAM_CHAT_ID_SALES!, imageBuffer, "📊 تقرير المبيعات الكامل");
    }

    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}