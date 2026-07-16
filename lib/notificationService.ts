import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════
// خدمة الإشعارات — قناة داخلية (in-app) شغالة، والبنية جاهزة
// لإضافة Telegram / Email لاحقاً من غير تعديل باقي الكود.
// ═══════════════════════════════════════════════════════════════

export type NotificationKind =
  | "due_today"
  | "due_tomorrow"
  | "overdue"
  | "high_priority"
  | "completed"
  | "general";

export interface NotificationPayload {
  actionId?: number;
  userId?: number | null; // null = إشعار عام للجميع
  kind: NotificationKind;
  title: string;
  description?: string;
}

export interface NotificationRow {
  id: number;
  action_id: number | null;
  user_id: number | null;
  kind: NotificationKind;
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── واجهة القناة: أي قناة جديدة (Telegram/Email) بتنفذ الواجهة دي ───
export interface NotificationChannel {
  name: string;
  send(payload: NotificationPayload): Promise<void>;
}

// ─── القناة الداخلية (جدول notifications في Supabase) ───────────
const inAppChannel: NotificationChannel = {
  name: "in_app",
  async send(payload) {
    const { error } = await supabase.from("notifications").insert({
      action_id: payload.actionId ?? null,
      user_id: payload.userId ?? null,
      kind: payload.kind,
      title: payload.title,
      description: payload.description ?? null,
    });
    if (error) throw new Error(error.message);
  },
};

// قنوات مستقبلية — أضيفي هنا مثلاً telegramChannel أو emailChannel
// وسجّليها في القائمة دي، ومفيش أي كود تاني محتاج يتغير:
const channels: NotificationChannel[] = [
  inAppChannel,
  // telegramChannel,  ← لاحقاً
  // emailChannel,     ← لاحقاً
];

export async function sendNotification(payload: NotificationPayload) {
  const results = await Promise.allSettled(channels.map((c) => c.send(payload)));
  results.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(`فشل إرسال الإشعار عبر قناة ${channels[i].name}:`, r.reason);
  });
}

// ─── قراءة الإشعارات (للـ navbar) ───────────────────────────────
export async function fetchNotifications(limit = 20): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as NotificationRow[]) || [];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);
  return count || 0;
}

export async function markNotificationRead(id: number) {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllNotificationsRead() {
  await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
}
