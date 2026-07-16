"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ACTION_TYPES, PRIORITIES, STATUSES,
  typeLabel, priorityMeta, statusMeta, todayStr, ActionRow,
} from "@/lib/actionsMeta";
import {
  ClipboardList, PlusCircle, Search, Loader2, Pencil, Trash2,
  CheckCircle2, Copy, X, Check, Calendar, ChevronLeft, ChevronRight,
  AlertTriangle, CalendarClock, ArrowUpDown, User, Phone,
} from "lucide-react";

const PAGE_SIZE = 25;

type QuickFilter = "" | "due_today" | "overdue" | "upcoming" | "completed_today" | "high_priority";

const EMPTY_FORM = {
  line_number: "",
  action_type: "follow_up",
  priority: "medium",
  title: "",
  description: "",
  due_date: "",
  start_date: "",
  assigned_user_id: "",
  notes: "",
};

function ActionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authorized, setAuthorized] = useState(false);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // فلاتر
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>((searchParams.get("filter") as QuickFilter) || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"due_date" | "created_at" | "priority">("due_date");
  const [sortAsc, setSortAsc] = useState(true);

  // مودالات
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [clientInfo, setClientInfo] = useState<{ id: number | null; name: string } | null>(null);
  const [lineChecked, setLineChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ActionRow | null>(null);
  const [completeForm, setCompleteForm] = useState({ notes: "", by: "", date: todayStr() });

  const [deleteTarget, setDeleteTarget] = useState<ActionRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const highlightId = searchParams.get("highlight");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
    supabase.from("users").select("id, full_name").eq("is_active", true)
      .then(({ data }) => setUsersList(data || []));
  }, []);

  // ─── تحميل الاجراءات ─────────────────────────────────────────
  async function loadActions() {
    setLoading(true);
    const today = todayStr();

    let query = supabase
      .from("actions")
      .select("*, clients(name), users:assigned_user_id(full_name)", { count: "exact" });

    if (search.trim())
      query = query.or(`line_number.ilike.%${search}%,title.ilike.%${search}%`);
    if (filterPriority) query = query.eq("priority", filterPriority);
    if (filterStatus) query = query.eq("status", filterStatus);
    if (filterType) query = query.eq("action_type", filterType);

    if (quickFilter === "due_today")
      query = query.eq("due_date", today).in("status", ["pending", "in_progress"]);
    else if (quickFilter === "overdue")
      query = query.lt("due_date", today).in("status", ["pending", "in_progress"]);
    else if (quickFilter === "upcoming")
      query = query.gt("due_date", today).in("status", ["pending", "in_progress"]);
    else if (quickFilter === "completed_today")
      query = query.eq("status", "completed").eq("completed_date", today);
    else if (quickFilter === "high_priority")
      query = query.in("priority", ["high", "urgent"]).in("status", ["pending", "in_progress"]);

    if (fromDate) query = query.gte("due_date", fromDate);
    if (toDate) query = query.lte("due_date", toDate);

    query = query.order(sortBy, { ascending: sortAsc }).order("id", { ascending: false });
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) { showToast(error.message, "error"); setLoading(false); return; }
    setActions((data as ActionRow[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(loadActions, 300);
    return () => clearTimeout(t);
  }, [authorized, search, filterPriority, filterStatus, filterType, quickFilter, fromDate, toDate, sortBy, sortAsc, page]);

  useEffect(() => { setPage(1); }, [search, filterPriority, filterStatus, filterType, quickFilter, fromDate, toDate]);

  // ─── جلب بيانات العميل من رقم الخط ──────────────────────────
  useEffect(() => {
    setLineChecked(false);
    setClientInfo(null);
    const num = form.line_number.trim();
    if (num.length < 8) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("lines")
        .select("client_id, clients(name)")
        .eq("number", num)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .limit(1);
      const line = data?.[0] as any;
      setLineChecked(true);
      if (line)
        setClientInfo({ id: line.client_id, name: line.clients?.name || "بدون عميل" });
    }, 400);
    return () => clearTimeout(t);
  }, [form.line_number]);

  // ─── إنشاء / تعديل ──────────────────────────────────────────
  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, due_date: todayStr(), start_date: todayStr() });
    setFormOpen(true);
  }

  function openEdit(a: ActionRow) {
    setEditingId(a.id);
    setForm({
      line_number: a.line_number,
      action_type: a.action_type,
      priority: a.priority,
      title: a.title,
      description: a.description || "",
      due_date: a.due_date,
      start_date: a.start_date || "",
      assigned_user_id: a.assigned_user_id ? String(a.assigned_user_id) : "",
      notes: a.notes || "",
    });
    setFormOpen(true);
  }

  async function saveForm() {
    if (!form.line_number.trim()) { showToast("ادخلي رقم الخط", "error"); return; }
    if (!form.title.trim()) { showToast("ادخلي عنوان الاجراء", "error"); return; }
    if (!form.due_date) { showToast("اختاري تاريخ الاستحقاق", "error"); return; }

    setSaving(true);
    const payload: any = {
      line_number: form.line_number.trim(),
      client_id: clientInfo?.id ?? null,
      action_type: form.action_type,
      priority: form.priority,
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date,
      start_date: form.start_date || null,
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("actions").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) { showToast(error.message, "error"); return; }
      showToast("تم تحديث الاجراء بنجاح");
    } else {
      payload.created_by = localStorage.getItem("full_name") || "Unknown";
      payload.status = "pending";
      const { error } = await supabase.from("actions").insert(payload);
      setSaving(false);
      if (error) { showToast(error.message, "error"); return; }
      showToast("تم إنشاء الاجراء بنجاح");
    }
    setFormOpen(false);
    loadActions();
  }

  // ─── إكمال ──────────────────────────────────────────────────
  function openComplete(a: ActionRow) {
    setCompleteTarget(a);
    setCompleteForm({ notes: "", by: localStorage.getItem("full_name") || "", date: todayStr() });
    setCompleteOpen(true);
  }

  async function saveComplete() {
    if (!completeTarget) return;
    if (!completeForm.by.trim()) { showToast("ادخلي اسم منفذ الإكمال", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("actions").update({
      status: "completed",
      completed_date: completeForm.date,
      completed_by: completeForm.by.trim(),
      completion_notes: completeForm.notes.trim() || null,
    }).eq("id", completeTarget.id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    showToast("تم إكمال الاجراء ✅");
    setCompleteOpen(false);
    loadActions();
  }

  // ─── حذف ────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("actions").delete().eq("id", deleteTarget.id);
    if (error) { showToast(error.message, "error"); return; }
    showToast("تم حذف الاجراء");
    setDeleteTarget(null);
    loadActions();
  }

  // ─── تكرار ──────────────────────────────────────────────────
  async function duplicateAction(a: ActionRow) {
    const { error } = await supabase.from("actions").insert({
      line_number: a.line_number,
      client_id: a.client_id,
      action_type: a.action_type,
      priority: a.priority,
      title: `${a.title} (نسخة)`,
      description: a.description,
      due_date: a.due_date,
      start_date: todayStr(),
      assigned_user_id: a.assigned_user_id,
      notes: a.notes,
      status: "pending",
      created_by: localStorage.getItem("full_name") || "Unknown",
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("تم تكرار الاجراء");
    loadActions();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = todayStr();

  const quickFilters: { key: QuickFilter; label: string; icon: React.ElementType }[] = [
    { key: "due_today", label: "مستحق اليوم", icon: CalendarClock },
    { key: "overdue", label: "متأخر", icon: AlertTriangle },
    { key: "upcoming", label: "قادم", icon: Calendar },
    { key: "high_priority", label: "أولوية عالية", icon: AlertTriangle },
  ];

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200";

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-violet-600" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">الاجراءات والمتابعه</h1>
              <p className="text-sm text-slate-500 mt-0.5">إدارة الإجراءات والتذكيرات المستقبلية للخطوط</p>
            </div>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm transition">
            <PlusCircle className="w-4 h-4" /> اجراء جديد
          </button>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickFilters.map((f) => {
            const Icon = f.icon;
            const active = quickFilter === f.key;
            return (
              <button key={f.key}
                onClick={() => setQuickFilter(active ? "" : f.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}>
                <Icon className="w-4 h-4" /> {f.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم الخط أو العنوان"
                className={`${inputClass} pr-10`} />
            </div>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={inputClass}>
              <option value="">كل الأولويات</option>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputClass}>
              <option value="">كل الحالات</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputClass}>
              <option value="">كل الأنواع</option>
              {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} title="من تاريخ" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} title="إلى تاريخ" />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <ClipboardList className="w-10 h-10 text-slate-200" />
            <p>لا توجد اجراءات مطابقة</p>
            <button onClick={openNew} className="text-blue-600 text-sm font-medium hover:underline">+ إنشاء اجراء جديد</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium cursor-pointer select-none" onClick={() => { setSortBy("due_date"); setSortAsc(sortBy !== "due_date" ? true : !sortAsc); }}>
                    <span className="inline-flex items-center gap-1">الاستحقاق <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="p-3 text-right font-medium">رقم الخط</th>
                  <th className="p-3 text-right font-medium">العميل</th>
                  <th className="p-3 text-right font-medium">العنوان</th>
                  <th className="p-3 text-right font-medium">النوع</th>
                  <th className="p-3 text-right font-medium cursor-pointer select-none" onClick={() => { setSortBy("priority"); setSortAsc(sortBy !== "priority" ? true : !sortAsc); }}>
                    <span className="inline-flex items-center gap-1">الأولوية <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="p-3 text-right font-medium">الحالة</th>
                  <th className="p-3 text-right font-medium">المسؤول</th>
                  <th className="p-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {actions.map((a) => {
                  const pm = priorityMeta(a.priority);
                  const sm = statusMeta(a.status);
                  const isOverdue = a.due_date < today && (a.status === "pending" || a.status === "in_progress");
                  const isDueToday = a.due_date === today && (a.status === "pending" || a.status === "in_progress");
                  const highlighted = highlightId && Number(highlightId) === a.id;
                  return (
                    <tr key={a.id} className={`border-t border-slate-100 hover:bg-slate-50/80 transition ${highlighted ? "bg-blue-50" : ""}`}>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          isOverdue ? "text-red-600" : isDueToday ? "text-orange-600" : "text-slate-600"
                        }`}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          {a.due_date}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-900">{a.line_number}</td>
                      <td className="p-3 text-slate-600">{a.clients?.name || "—"}</td>
                      <td className="p-3 max-w-[220px]">
                        <p className="font-medium text-slate-900 truncate" title={a.title}>{a.title}</p>
                        {a.description && <p className="text-xs text-slate-400 truncate" title={a.description}>{a.description}</p>}
                      </td>
                      <td className="p-3"><span className="inline-flex px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600">{typeLabel(a.action_type)}</span></td>
                      <td className="p-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${pm.badge}`}>{pm.label}</span></td>
                      <td className="p-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${sm.badge}`}>{sm.label}</span></td>
                      <td className="p-3 text-slate-600 text-xs">{a.users?.full_name || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {(a.status === "pending" || a.status === "in_progress") && (
                            <button onClick={() => openComplete(a)} title="إكمال"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => openEdit(a)} title="تعديل"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => duplicateAction(a)} title="تكرار"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(a)} title="حذف"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
              <span className="text-xs text-slate-400">{total.toLocaleString()} اجراء</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> السابق
                </button>
                <span className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 text-sm font-medium">
                  التالي <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── مودال إنشاء/تعديل ─────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? "تعديل اجراء" : "اجراء جديد"}</h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">رقم الخط *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={form.line_number} onChange={(e) => setForm({ ...form, line_number: e.target.value })}
                    className={`${inputClass} pr-9 font-mono`} placeholder="01xxxxxxxxx" />
                </div>
                {form.line_number.trim().length >= 8 && lineChecked && (
                  clientInfo ? (
                    <p className="flex items-center gap-1 text-xs text-green-600 mt-1.5">
                      <User className="w-3.5 h-3.5" /> العميل: {clientInfo.name}
                    </p>
                  ) : (
                    <p className="text-xs text-orange-500 mt-1.5">⚠ الرقم مش موجود في الخطوط — هيتسجل بدون عميل</p>
                  )
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">نوع الاجراء *</label>
                <select value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })} className={inputClass}>
                  {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الأولوية *</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">المستخدم المسؤول</label>
                <select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })} className={inputClass}>
                  <option value="">بدون تحديد</option>
                  {usersList.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5">العنوان *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass} placeholder="مثال: متابعة طلب تغيير الباقة" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5">الوصف</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">تاريخ البداية</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">تاريخ الاستحقاق *</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} className={`${inputClass} resize-none`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setFormOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">إلغاء</button>
              <button onClick={saveForm} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? "حفظ التعديلات" : "إنشاء الاجراء"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── مودال الإكمال ─────────────────────────────────────── */}
      {completeOpen && completeTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCompleteOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">إكمال الاجراء</h2>
                <p className="text-xs text-slate-500">{completeTarget.title}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">تم الإكمال بواسطة *</label>
                <input value={completeForm.by} onChange={(e) => setCompleteForm({ ...completeForm, by: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">تاريخ الإكمال *</label>
                <input type="date" value={completeForm.date} onChange={(e) => setCompleteForm({ ...completeForm, date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">ملاحظات الإكمال</label>
                <textarea value={completeForm.notes} onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  rows={3} className={`${inputClass} resize-none`} placeholder="اكتبي أي تفاصيل عن تنفيذ الاجراء..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setCompleteOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">إلغاء</button>
              <button onClick={saveComplete} disabled={saving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                إكمال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── تأكيد الحذف ───────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-red-500" />
            </span>
            <h2 className="text-base font-bold text-slate-900 mb-1">حذف الاجراء؟</h2>
            <p className="text-sm text-slate-500 mb-5">"{deleteTarget.title}" — الإجراء ده مينفعش يترجع.</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition">إلغاء</button>
              <button onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition">حذف نهائياً</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-6 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === "success" ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    }>
      <ActionsPageInner />
    </Suspense>
  );
}
