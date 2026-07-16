import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════════
// إشعارات مجدولة للأكشنات — بتتنفذ يومياً عبر Vercel Cron:
//   • قبل الاستحقاق بيوم  → due_tomorrow
//   • يوم الاستحقاق       → due_today
//   • بعد فوات الاستحقاق  → overdue
//
// البنية قابلة للتوسعة: أي قناة جديدة (Telegram / Email) بتنفذ
// واجهة CronNotificationChannel وتتسجل في قائمة channels تحت —
// من غير أي تعديل في منطق الفحص نفسه.
// ═══════════════════════════════════════════════════════════════

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CronNotificationPayload {
  actionId: number;
  userId: number | null;
  kind: "due_tomorrow" | "due_today" | "overdue";
  title: string;
  description: string;
}

interface CronNotificationChannel {
  name: string;
  send(payload: CronNotificationPayload): Promise<void>;
}

// ─── القناة الداخلية (جدول notifications) ────────────────────────
function makeInAppChannel(supabase: ReturnType<typeof getSupabase>): CronNotificationChannel {
  return {
    name: "in_app",
    async send(p) {
      const { error } = await supabase.from("notifications").insert({
        action_id: p.actionId,
        user_id: p.userId,
        kind: p.kind,
        title: p.title,
        description: p.description,
      });
      if (error) throw new Error(error.message);
    },
  };
}

// ─── قنوات مستقبلية — مثال جاهز للتفعيل لاحقاً: ──────────────────
// function makeTelegramChannel(): CronNotificationChannel {
//   return {
//     name: "telegram",
//     async send(p) {
//       // fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, ...)
//     },
//   };
// }
// function makeEmailChannel(): CronNotificationChannel { ... }

const KIND_TITLES: Record<CronNotificationPayload["kind"], string> = {
  due_tomorrow: "أكشن مستحق غداً",
  due_today: "أكشن مستحق اليوم",
  overdue: "أكشن متأخر",
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const supabase = getSupabase();
  const channels: CronNotificationChannel[] = [
    makeInAppChannel(supabase),
    // makeTelegramChannel(),  ← لاحقاً
    // makeEmailChannel(),     ← لاحقاً
  ];

  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

    // الأكشنات المفتوحة اللي معادها قرب أو عدى
    const { data: openActions, error } = await supabase
      .from("actions")
      .select("id, line_number, title, due_date, assigned_user_id, notification_sent")
      .in("status", ["pending", "in_progress"])
      .lte("due_date", tomorrow);
    if (error) throw new Error(error.message);

    // إشعارات النهارده اللي اتبعتت قبل كده (منع التكرار في نفس اليوم)
    const { data: sentToday } = await supabase
      .from("notifications")
      .select("action_id, kind")
      .gte("created_at", `${today}T00:00:00`)
      .in("kind", ["due_tomorrow", "due_today", "overdue"]);
    const alreadySent = new Set((sentToday || []).map((n: any) => `${n.action_id}|${n.kind}`));

    let sent = 0;
    for (const a of openActions || []) {
      let kind: CronNotificationPayload["kind"] | null = null;
      if (a.due_date === tomorrow) kind = "due_tomorrow";
      else if (a.due_date === today) kind = "due_today";
      else if (a.due_date < today) kind = "overdue";
      if (!kind) continue;
      if (alreadySent.has(`${a.id}|${kind}`)) continue;

      const payload: CronNotificationPayload = {
        actionId: a.id,
        userId: a.assigned_user_id,
        kind,
        title: KIND_TITLES[kind],
        description: `${a.title} — خط ${a.line_number} (استحقاق ${a.due_date})`,
      };

      const results = await Promise.allSettled(channels.map((c) => c.send(payload)));
      results.forEach((r, i) => {
        if (r.status === "rejected")
          console.error(`فشل الإرسال عبر ${channels[i].name} للأكشن ${a.id}:`, r.reason);
      });
      if (results.some((r) => r.status === "fulfilled")) sent++;

      // علّمي الأكشن إن الإشعار اتبعت (أول مرة بس)
      if (!a.notification_sent) {
        await supabase.from("actions").update({ notification_sent: true }).eq("id", a.id);
      }
    }

    return NextResponse.json({ success: true, checked: openActions?.length || 0, sent });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
