import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 60;

// الأقسام اللي عايزين تقرير سداد/تحصيل خاص بيها كل واحد لوحده (زي شاشة "متابعة التحصيل")
const TARGET_DEPARTMENTS = ["منافذ", "المكتب", "فورى", "مكتب الغردقه", "مايجريشن"];

const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function getProviderColor(name: string) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("etisalat") || lower.includes("اتصالات")) return "#22c55e";
  if (lower.includes("orange") || lower.includes("اورنج")) return "#f97316";
  if (lower.includes("vodafone") || lower.includes("فودافون")) return "#ef4444";
  return "#3b82f6";
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ProviderStat {
  name: string;
  total: number;
  paid: number;
  unpaid: number;
  revenue: number;
  collected: number;
  color: string;
}

interface DeptReportData {
  deptName: string;
  totals: {
    totalLines: number;
    paidLines: number;
    unpaidLines: number;
    totalRevenue: number;
    totalCollected: number;
  };
  providerStats: ProviderStat[];
}

// ─── نفس منطق حساب الإحصائيات بتاع شاشة "متابعة التحصيل" لكن لقسم واحد بس ───
async function getDeptCollectionData(
  deptId: number,
  deptName: string,
  filterMonth: string
): Promise<DeptReportData> {
  const supabase = getSupabase();

  const allLines: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("lines")
      .select("number, total_price, provider_id, providers(name)")
      .eq("department_id", deptId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allLines.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const paidNumbers = new Set<string>();
  const paidAmounts = new Map<string, number>();
  let pOffset = 0;
  while (true) {
    const { data } = await supabase
      .from("payments")
      .select("line_number, amount")
      .eq("payment_month", filterMonth)
      .range(pOffset, pOffset + 999);
    if (!data || data.length === 0) break;
    data.forEach((p: any) => {
      if (p.line_number) {
        paidNumbers.add(p.line_number);
        paidAmounts.set(p.line_number, (paidAmounts.get(p.line_number) || 0) + (p.amount || 0));
      }
    });
    if (data.length < 1000) break;
    pOffset += 1000;
  }

  const provMap = new Map<string, ProviderStat>();
  let totalRevenue = 0;
  let totalCollected = 0;
  let paidCount = 0;

  allLines.forEach((line: any) => {
    const provName = line.providers?.name || "غير محدد";
    if (!provMap.has(provName)) {
      provMap.set(provName, {
        name: provName, total: 0, paid: 0, unpaid: 0, revenue: 0, collected: 0,
        color: getProviderColor(provName),
      });
    }
    const prov = provMap.get(provName)!;
    prov.total++;
    prov.revenue += line.total_price || 0;
    totalRevenue += line.total_price || 0;

    if (paidNumbers.has(line.number)) {
      prov.paid++;
      paidCount++;
      const collected = paidAmounts.get(line.number) || 0;
      prov.collected += collected;
      totalCollected += collected;
    } else {
      prov.unpaid++;
    }
  });

  return {
    deptName,
    totals: {
      totalLines: allLines.length,
      paidLines: paidCount,
      unpaidLines: allLines.length - paidCount,
      totalRevenue,
      totalCollected,
    },
    providerStats: [...provMap.values()].sort((a, b) => b.total - a.total),
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
  if (!match) throw new Error("مقدرش ألاقي رابط الخط جوه رد جوجل فونتس");

  const fontRes = await fetch(match[1]);
  const buffer = await fontRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  return { base64: btoa(binary), format: match[2] };
}

function buildHtml(data: DeptReportData, filterMonth: string, font: { base64: string; format: string }) {
  const [y, m] = filterMonth.split("-");
  const monthLabel = `${MONTH_NAMES_AR[Number(m) - 1]} ${y}`;
  const { totals, providerStats } = data;

  const collectionRate = totals.totalLines > 0 ? (totals.paidLines / totals.totalLines) * 100 : 0;
  const paymentRate = totals.totalRevenue > 0 ? (totals.totalCollected / totals.totalRevenue) * 100 : 0;

  const kpis: { label: string; value: string; color: string; sub?: string }[] = [
    { label: "إجمالي الخطوط", value: totals.totalLines.toLocaleString(), color: "#1e293b" },
    { label: "اجمالى المسدد", value: totals.paidLines.toLocaleString(), color: "#16a34a" },
    { label: "اجمالى الغير مسدد", value: totals.unpaidLines.toLocaleString(), color: "#ef4444" },
    { label: "إجمالي المستحق", value: totals.totalRevenue.toLocaleString(), color: "#9333ea", sub: "جنيه" },
    { label: "إجمالي المحصل", value: totals.totalCollected.toLocaleString(), color: "#16a34a", sub: "جنيه" },
    { label: "نسبة السداد", value: `${collectionRate.toFixed(1)}%`, color: "#2563eb" },
    { label: "نسبة التحصيل", value: `${paymentRate.toFixed(1)}%`, color: "#0d9488" },
  ];

  const kpiHtml = kpis.map((k) => `
    <div class="kpi-card">
      <p class="kpi-label">${k.label}</p>
      <p class="kpi-value" style="color:${k.color};">${k.value}</p>
      ${k.sub ? `<p class="kpi-sub">${k.sub}</p>` : ""}
    </div>
  `).join("");

  const providerHtml = providerStats.map((p) => {
    const rate = p.total > 0 ? Math.round((p.paid / p.total) * 100) : 0;
    return `
      <div class="prov-card">
        <div class="prov-head">
          <div class="prov-name"><span class="dot" style="background:${p.color};"></span>${p.name}</div>
          <span class="rate-badge" style="background:${p.color}22; color:${p.color};">${rate}% نسبة السداد</span>
        </div>
        <div class="mini-stats">
          <div class="mini red"><p class="mini-value">${p.unpaid.toLocaleString()}</p><p class="mini-label">غير مسدد</p></div>
          <div class="mini green"><p class="mini-value">${p.paid.toLocaleString()}</p><p class="mini-label">مسدد</p></div>
          <div class="mini gray"><p class="mini-value">${p.total.toLocaleString()}</p><p class="mini-label">إجمالي</p></div>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${rate}%; background:${p.color};"></div></div>
        <div class="prov-footer">
          <span>المستحق: <strong>${p.revenue.toLocaleString()}</strong></span>
          <span>المحصل: <strong class="green-text">${p.collected.toLocaleString()}</strong></span>
        </div>
      </div>
    `;
  }).join("");

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
        body { width: 1180px; background:#f8fafc; padding: 30px; direction: rtl; color:#1e293b; }
        .green-text { color:#16a34a; }

        .header { background: linear-gradient(135deg, #2563eb, #3b82f6); border-radius: 20px; padding: 22px 26px; display:flex; align-items:center; justify-content: space-between; margin-bottom: 22px; }
        .header h1 { color:white; font-size: 24px; font-weight: bold; }
        .header p { color:#dbeafe; font-size: 14px; margin-top: 4px; }
        .header .icon { width: 48px; height:48px; border-radius:16px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; font-size:22px; }

        .kpi-grid { display:flex; gap:14px; margin-bottom: 22px; }
        .kpi-card { flex:1; background:white; border-radius:16px; border:1px solid #e2e8f0; padding:16px; }
        .kpi-label { font-size:13px; color:#64748b; }
        .kpi-value { font-size:26px; font-weight:bold; margin-top:8px; }
        .kpi-sub { font-size:12px; color:#94a3b8; margin-top:2px; }

        .prov-grid { display:flex; gap:14px; }
        .prov-card { flex:1; background:white; border-radius:16px; border:1px solid #e2e8f0; padding:18px; }
        .prov-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .prov-name { display:flex; align-items:center; gap:8px; font-size:17px; font-weight:bold; }
        .dot { width:11px; height:11px; border-radius:50%; display:inline-block; }
        .rate-badge { font-size:12px; font-weight:bold; padding:5px 10px; border-radius:999px; }
        .mini-stats { display:flex; gap:8px; text-align:center; margin-bottom:14px; }
        .mini { flex:1; border-radius:12px; padding:10px; }
        .mini.red { background:#fef2f2; }
        .mini.green { background:#f0fdf4; }
        .mini.gray { background:#f8fafc; }
        .mini-value { font-size:20px; font-weight:bold; }
        .mini.red .mini-value { color:#ef4444; }
        .mini.green .mini-value { color:#16a34a; }
        .mini-label { font-size:12px; color:#94a3b8; margin-top:2px; }
        .bar { height:8px; background:#f1f5f9; border-radius:999px; overflow:hidden; margin-bottom:12px; }
        .bar-fill { height:100%; border-radius:999px; }
        .prov-footer { display:flex; justify-content:space-between; font-size:13px; color:#64748b; }
        .prov-footer strong { color:#1e293b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>تقرير نسبة السداد والتحصيل لـ ${data.deptName}</h1>
          <p>عن شهر ${monthLabel}</p>
        </div>
        <div class="icon">📄</div>
      </div>
      <div class="kpi-grid">${kpiHtml}</div>
      <div class="prov-grid">${providerHtml || `<div class="prov-card">مفيش خطوط بشبكات محددة للقسم ده</div>`}</div>
    </body>
    </html>
  `;
}

async function renderImage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  html: string
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1180, height: 700 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 500));

    // اضبطي ارتفاع الـ viewport على الارتفاع الحقيقي للمحتوى بعد التحميل بدل ما نتخمنه —
    // فرق كبير بين الاتنين بيرجّع صورة فاضية بيضاء
    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width: 1180, height: contentHeight });

    const screenshot = await page.screenshot({ type: "png" });
    return screenshot as Buffer;
  } finally {
    await page.close();
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { data: departments } = await supabase.from("departments").select("id, name");
    const targets = (departments || []).filter((d) => TARGET_DEPARTMENTS.includes(d.name));

    if (targets.length === 0) {
      return NextResponse.json(
        { success: false, error: "مفيش أقسام في الداتابيز متطابقة مع القائمة المطلوبة" },
        { status: 404 }
      );
    }

    const now = new Date();
    const filterMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const font = await loadArabicFontBase64();

    // @sparticuz/chromium بيحدد إنه شغال جوا Lambda من خلال env vars — Vercel مش بيضبطها،
    // فبنضبط LD_LIBRARY_PATH يدوياً على مسار استخراج الـ binary عشان مكتباته يلاقيها.
    const executablePath = await chromium.executablePath();
    process.env.LD_LIBRARY_PATH = `${path.dirname(executablePath)}:${process.env.LD_LIBRARY_PATH || ""}`;

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const results: { department: string; telegram: any }[] = [];
    try {
      for (const dept of targets) {
        const data = await getDeptCollectionData(dept.id, dept.name, filterMonth);
        const html = buildHtml(data, filterMonth, font);
        const imageBuffer = await renderImage(browser, html);
        const telegram = await sendTelegramPhoto(
          process.env.TELEGRAM_CHAT_ID_COLLECTION!,
          imageBuffer,
          `💰 تقرير نسبة السداد والتحصيل — ${dept.name}`
        );
        results.push({ department: dept.name, telegram });
      }
    } finally {
      await browser.close();
    }

    const missing = TARGET_DEPARTMENTS.filter((n) => !targets.find((t) => t.name === n));

    return NextResponse.json({ success: true, results, missingDepartments: missing });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
