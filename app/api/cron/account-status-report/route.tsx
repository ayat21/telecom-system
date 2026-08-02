import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 45;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface AccountStatusRow {
  account_no: string;
  account_name: string;
  total: number;
  active: number;
  byStatus: Record<string, number>;
}

interface AccountStatusReport {
  columns: string[];
  rows: AccountStatusRow[];
  totals: { total: number; active: number; byStatus: Record<string, number> };
}

// ─── نفس منطق تقرير "الحالات حسب الأكونت" في شاشة تقرير أرقام الحساب ───
async function getAccountStatusReport(): Promise<AccountStatusReport> {
  const supabase = getSupabase();

  const [{ data: allAccounts }, { data: allStatuses }] = await Promise.all([
    supabase.from("accounts").select("id, account_no, account_name"),
    supabase.from("line_statuses").select("id, name"),
  ]);

  const statusNameById = new Map<number, string>();
  (allStatuses || []).forEach((s: any) => statusNameById.set(s.id, s.name));

  const lines: { account_id: number; line_status_id: number | null }[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("lines")
      .select("account_id, line_status_id")
      .not("account_id", "is", null)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    lines.push(...(data as any));
    if (data.length < 1000) break;
    offset += 1000;
  }

  const accountAgg = new Map<number, { total: number; byStatus: Map<string, number> }>();
  lines.forEach((l) => {
    if (!accountAgg.has(l.account_id)) accountAgg.set(l.account_id, { total: 0, byStatus: new Map() });
    const agg = accountAgg.get(l.account_id)!;
    agg.total++;
    const statusName = l.line_status_id ? statusNameById.get(l.line_status_id) : null;
    if (statusName) agg.byStatus.set(statusName, (agg.byStatus.get(statusName) || 0) + 1);
  });

  const statusTotals = new Map<string, number>();
  accountAgg.forEach((agg) => {
    agg.byStatus.forEach((count, name) => {
      if (name.trim().toLowerCase() === "active") return;
      statusTotals.set(name, (statusTotals.get(name) || 0) + count);
    });
  });
  const columns = [...statusTotals.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const rows: AccountStatusRow[] = (allAccounts || [])
    .map((a: any) => {
      const agg = accountAgg.get(a.id);
      const total = agg?.total || 0;
      const active = agg?.byStatus.get("Active") || agg?.byStatus.get("active") || 0;
      const byStatus: Record<string, number> = {};
      columns.forEach((c) => { byStatus[c] = agg?.byStatus.get(c) || 0; });
      return {
        account_no: a.account_no,
        account_name: a.account_name || "—",
        total, active, byStatus,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => a.account_no.localeCompare(b.account_no));

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.active += r.active;
      columns.forEach((c) => { acc.byStatus[c] = (acc.byStatus[c] || 0) + r.byStatus[c]; });
      return acc;
    },
    { total: 0, active: 0, byStatus: Object.fromEntries(columns.map((c) => [c, 0])) as Record<string, number> }
  );

  return { columns, rows, totals };
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

function buildHtml(report: AccountStatusReport, font: { base64: string; format: string }) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const suspended = report.totals.total - report.totals.active;

  const headerCols = `
    <th>رقم الأكونت</th>
    <th>اسم الأكونت</th>
    <th>Total</th>
    <th>Active</th>
    ${report.columns.map((c) => `<th>${c}</th>`).join("")}
  `;

  const rowsHtml = report.rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? "" : "alt"}">
      <td class="ltr">${r.account_no}</td>
      <td>${r.account_name}</td>
      <td class="num bold">${r.total.toLocaleString()}</td>
      <td class="num green">${r.active.toLocaleString()}</td>
      ${report.columns.map((c) => `<td class="num ${r.byStatus[c] > 0 ? "red" : "dim"}">${r.byStatus[c].toLocaleString()}</td>`).join("")}
    </tr>
  `).join("");

  const footerHtml = `
    <tr class="foot">
      <td colspan="2">Total</td>
      <td class="num">${report.totals.total.toLocaleString()}</td>
      <td class="num">${report.totals.active.toLocaleString()}</td>
      ${report.columns.map((c) => `<td class="num">${report.totals.byStatus[c].toLocaleString()}</td>`).join("")}
    </tr>
  `;

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
        body { background:#f8fafc; padding: 24px; direction: rtl; color:#1e293b; }
        .sub { color:#64748b; font-size:13px; margin-bottom:4px; }
        .title { font-size:22px; font-weight:bold; margin-bottom:16px; }
        table { border-collapse: collapse; width: 100%; background:white; }
        th { background:#1d4ed8; color:white; padding:9px 10px; font-size:13px; font-weight:bold; white-space:nowrap; text-align:center; }
        th:nth-child(1), th:nth-child(2) { text-align:right; }
        td { padding:8px 10px; font-size:13px; white-space:nowrap; border-bottom:1px solid #e2e8f0; }
        td.num { text-align:center; }
        td.ltr { direction: ltr; text-align:right; }
        td.bold { font-weight:bold; }
        td.green { color:#16a34a; font-weight:600; }
        td.red { color:#ef4444; font-weight:600; }
        td.dim { color:#cbd5e1; }
        tr.alt td { background:#f8fafc; }
        tr.foot td { background:#1e293b; color:white; font-weight:bold; }
        .suspended-box { margin-top:14px; background:#f1f5f9; border-radius:12px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; }
        .suspended-label { font-size:14px; font-weight:600; color:#475569; }
        .suspended-value { font-size:20px; font-weight:bold; color:#ef4444; }
      </style>
    </head>
    <body>
      <div class="sub">${dateLabel}</div>
      <div class="title">تقرير الحالات حسب الأكونت</div>
      <table>
        <thead><tr>${headerCols}</tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>${footerHtml}</tfoot>
      </table>
      <div class="suspended-box">
        <span class="suspended-label">إجمالي الخطوط الموقوفة</span>
        <span class="suspended-value">${suspended.toLocaleString()}</span>
      </div>
    </body>
    </html>
  `;
}

async function renderImage(html: string, width: number): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `${path.dirname(executablePath)}:${process.env.LD_LIBRARY_PATH || ""}`;

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 500));

    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewport({ width, height: contentHeight });

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
    const report = await getAccountStatusReport();

    if (report.rows.length === 0) {
      return NextResponse.json({ success: true, message: "مفيش بيانات للتقرير — تم التخطي" });
    }

    const font = await loadArabicFontBase64();
    // عرض الصورة بيكبر مع عدد أعمدة الحالات عشان الجدول ميتقصفش
    const width = Math.min(2200, 480 + (report.columns.length + 2) * 130);
    const html = buildHtml(report, font);
    const imageBuffer = await renderImage(html, width);

    const chatId = process.env.TELEGRAM_CHAT_ID_ACCOUNTS || process.env.TELEGRAM_CHAT_ID_COLLECTION!;
    let result = await sendTelegramPhoto(chatId, imageBuffer, "📊 تقرير الحالات حسب الأكونت");

    // لو الصورة كبيرة جداً وتلجرام رفضها كـ Photo، ابعتيها كملف
    if (!result.ok) {
      result = await sendTelegramDocument(chatId, imageBuffer, "📊 تقرير الحالات حسب الأكونت");
    }

    return NextResponse.json({ success: true, telegram: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
