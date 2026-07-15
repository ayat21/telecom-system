import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const maxDuration = 30;
chromium.setGraphicsMode = false;


const EXCLUDED_DEPARTMENTS = ["SPOC", "فوري", "العهدة", "هيثم"];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DeptStat {
  name: string;
  required: number;
  collected: number;
  rate: number;
}

async function getCollectionData(): Promise<DeptStat[]> {
  const supabase = getSupabase();

  const deptLineNumbers = new Map<string, Set<string>>();
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

  const stats: DeptStat[] = [];
  deptLineNumbers.forEach((numbers, deptName) => {
    let collected = 0;
    numbers.forEach((num) => { collected += paidAmountByLine.get(num) || 0; });
    const required = deptRequired.get(deptName) || 0;
    const rate = required > 0 ? Math.round((collected / required) * 100) : 0;
    stats.push({ name: deptName, required, collected, rate });
  });

  stats.sort((a, b) => b.required - a.required);
  return stats;
}

function buildHtml(stats: DeptStat[]) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const rows = Math.ceil(stats.length / 3);
  const height = 220 + rows * 150;

  const cardsHtml = stats.map((s) => `
    <div class="card">
      <div class="dept-name">${s.name}</div>
      <div class="rate-row">
        <span class="rate">${s.rate}</span><span class="percent">%</span>
      </div>
      <div class="detail">محصل ${s.collected.toLocaleString()} / مطلوب ${s.required.toLocaleString()}</div>
    </div>
  `).join("");

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          width: 900px; height: ${height}px;
          font-family: Arial, Tahoma, sans-serif;
          background: linear-gradient(135deg, #059669, #047857);
          padding: 40px; color: white; direction: rtl;
        }
        .sub { color:#d1fae5; font-size:20px; }
        .title { color:white; font-size:38px; font-weight:bold; margin-top:4px; margin-bottom:24px; }
        .grid { display:flex; flex-wrap:wrap; gap:16px; }
        .card { background:rgba(255,255,255,0.15); border-radius:20px; padding:18px; width:270px; }
        .dept-name { font-size:22px; font-weight:bold; }
        .rate-row { display:flex; align-items:baseline; margin-top:8px; }
        .rate { font-size:44px; font-weight:bold; }
        .percent { color:#d1fae5; font-size:20px; margin-right:4px; }
        .detail { color:#d1fae5; font-size:15px; margin-top:6px; }
      </style>
    </head>
    <body>
      <div class="sub">${dateLabel}</div>
      <div class="title">تقرير نسبة السداد لكل قسم</div>
      <div class="grid">${cardsHtml}</div>
    </body>
    </html>
  `;
}

async function renderImage(html: string, height: number): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height });
    await page.setContent(html, { waitUntil: "networkidle0" });
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const stats = await getCollectionData();
    const height = 220 + Math.ceil(stats.length / 3) * 150;
    const html = buildHtml(stats);
    const imageBuffer = await renderImage(html, height);
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