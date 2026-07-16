// ─── تعريفات مشتركة لموديول الأكشنات ────────────────────────────

export const ACTION_TYPES: { value: string; label: string }[] = [
  { value: "customer_request", label: "طلب خط جديد" },
  { value: "cancellation", label: "إلغاء" },
  { value: "migration", label: "مايجريشن" },
  { value: "package_change", label: "تغيير باقة" },
  { value: "sim_replacement", label: "استبدال شريحة" },
  { value: "follow_up", label: "متابعة" },
  { value: "payment_reminder", label: "تذكير سداد" },
  { value: "customer_complaint", label: "شكوى عميل" },
  { value: "other", label: "أخرى" },
];

export const PRIORITIES: { value: string; label: string; badge: string }[] = [
  { value: "low", label: "منخفضة", badge: "bg-slate-100 text-slate-600" },
  { value: "medium", label: "متوسطة", badge: "bg-blue-50 text-blue-700" },
  { value: "high", label: "عالية", badge: "bg-orange-50 text-orange-700" },
  { value: "urgent", label: "عاجلة", badge: "bg-red-50 text-red-700" },
];

export const STATUSES: { value: string; label: string; badge: string }[] = [
  { value: "pending", label: "قيد الانتظار", badge: "bg-amber-50 text-amber-700" },
  { value: "in_progress", label: "جاري التنفيذ", badge: "bg-blue-50 text-blue-700" },
  { value: "completed", label: "مكتمل", badge: "bg-green-50 text-green-700" },
  { value: "cancelled", label: "ملغى", badge: "bg-slate-100 text-slate-500" },
];

export const typeLabel = (v: string) => ACTION_TYPES.find((t) => t.value === v)?.label || v;
export const priorityMeta = (v: string) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[1];
export const statusMeta = (v: string) => STATUSES.find((s) => s.value === v) || STATUSES[0];

export const todayStr = () => new Date().toISOString().slice(0, 10);

export interface ActionRow {
  id: number;
  line_number: string;
  client_id: number | null;
  action_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string;
  completed_date: string | null;
  completion_notes: string | null;
  assigned_user_id: number | null;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  notification_sent: boolean;
  clients?: { name: string } | null;
  users?: { full_name: string } | null;
}
