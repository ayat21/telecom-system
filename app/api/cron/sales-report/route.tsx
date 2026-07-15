
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIGRATION_DEPT_ID = 10;

// ─── غيّري التاريخ ده لأي تاريخ عايزة التقرير يبدأ منه ───
const START_DATE = "2026-01-01";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getSalesData() {
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
  return { sales, migration, total: sales + migration };
}

// ─── خط عربي مدمج داخل الـ HTML (Base64) عشان يظهر جوه المتصفح على السيرفر ───
async function loadArabicFontBase64(): Promise<string> {
  const res = await fetch(
    "https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyAe0.ttf"
  );
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildHtml(sales: number, migration: number, total: number, fontBase64: string) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const [sy, sm, sd] = START_DATE.split("-");
  const startLabel = `${sd}/${sm}/${sy}`;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <style>
        @font-face {
          font-family: 'ArFont';
          src: url(data:font/truetype;charset=utf-8;base64,${fontBase64}) format('truetype');
        }
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          width: 800px; height: 500px;
          font-family: 'ArFont', Arial, sans-serif;
          background: linear-gradient(135deg, #2563eb, #1e40af);
          padding: 40px; color: white; direction: rtl;
        }
        .sub { color:#dbeafe; font-size:20px; }
        .title { color:white; font-size:38px; font-weight:bold; margin-top:4px; }
        .row { display:flex; gap:20px; margin-top:26px; }
        .card { flex:1; background:rgba(255,255,255,0.15); border-radius:24px; padding:24px; text-align:center; }
        .card.total { background:rgba(255,255,255,0.25); }
        .label { font-size:22px; }
        .value { font-size:62px; font-weight:bold; margin-top:8px; }
        .sales-label { color:#bbf7d0; }
        .migration-label { color:#fed7aa; }
        .total-label { color:#e0e7ff; }
      </style>
    </head>
    <body>
      <div class="sub">من ${startLabel} — تقرير بتاريخ ${dateLabel}</div>
      <div class="title">تقرير المبيعات</div>
      <div class="row">
        <div class="card">
          <div class="label sales-label">مبيعات</div>
          <div class="value">${sales}</div>
        </div>
        <div class="card">
          <div class="label migration-label">مايجريشن</div>
          <div class="value">${migration}</div>
        </div>
        <div class="card total">
          <div class="label total-label">الإجمالي</div>
          <div class="value">${total}</div>
        </div>
      </div>
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
    await page.setViewport({ width: 800, height: 500 });
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
    const { sales, migration, total } = await getSalesData();
    const fontBase64 = await loadArabicFontBase64();
    const html = buildHtml(sales, migration, total, fontBase64);
    const imageBuffer = await renderImage(html);
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