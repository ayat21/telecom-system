"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Activity, Network, Loader2, PlusCircle, Pencil, Trash2,
  X, Check, ChevronDown, Hash,
} from "lucide-react";

interface LineStatus {
  id: number;
  name: string;
  provider_id: number;
  providers?: { name: string };
  _count?: number;
}

const EMPTY_FORM = { name: "", provider_id: "" };

// ألوان تلقائية للكروت
const CARD_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", count: "text-blue-600", icon: "bg-blue-100" },
  { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", count: "text-green-600", icon: "bg-green-100" },
  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", count: "text-purple-600", icon: "bg-purple-100" },
  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", count: "text-orange-600", icon: "bg-orange-100" },
  { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", count: "text-pink-600", icon: "bg-pink-100" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", count: "text-teal-600", icon: "bg-teal-100" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", count: "text-indigo-600", icon: "bg-indigo-100" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", count: "text-amber-600", icon: "bg-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", count: "text-rose-600", icon: "bg-rose-100" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", count: "text-cyan-600", icon: "bg-cyan-100" },
];

export default function LineStatusesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [statuses, setStatuses] = useState<LineStatus[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProvider, setFilterProvider] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const canEdit = isSuperAdmin || isAdmin;

  useEffect(() => {
    const r = localStorage.getItem("role") || "";
    setRole(r);
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Load ─────────────────────────────────────────────────
  async function loadData() {
    setLoading(true);

    const [{ data: p }, { data: s }, { data: linesData }] = await Promise.all([
      supabase.from("providers").select("*"),
      supabase.from("line_statuses").select("*, providers(name)"),
      supabase.from("lines")
        .select("line_status_id")
        .or("is_deleted.is.null,is_deleted.eq.false"),
    ]);

    setProviders(p || []);

    // احسب عدد الخطوط لكل حالة
    const countMap = new Map<number, number>();
    (linesData || []).forEach((line) => {
      if (line.line_status_id) {
        countMap.set(line.line_status_id, (countMap.get(line.line_status_id) || 0) + 1);
      }
    });

    const withCounts = (s || []).map((status) => ({
      ...status,
      _count: countMap.get(status.id) || 0,
    }));

    setStatuses(withCounts);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // ─── Filter ───────────────────────────────────────────────
  const filtered = filterProvider
    ? statuses.filter((s) => String(s.provider_id) === filterProvider)
    : statuses;

  const totalLines = filtered.reduce((sum, s) => sum + (s._count || 0), 0);

  // ─── Modal ────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM, provider_id: filterProvider });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(status: LineStatus) {
    setForm({ name: status.name, provider_id: String(status.provider_id) });
    setEditingId(status.id);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.provider_id) {
      alert("الاسم والشبكة مطلوبين"); return;
    }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      provider_id: Number(form.provider_id),
    };

    if (editingId) {
      const { error } = await supabase.from("line_statuses").update(payload).eq("id", editingId);
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("line_statuses").insert(payload);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  async function deleteStatus(id: number) {
    if (!confirm("هل أنت متأكد من حذف الحالة؟")) return;
    const { error } = await supabase.from("line_statuses").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    loadData();
  }

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-indigo-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">حالات الخطوط</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {filtered.length} حالة — {totalLines.toLocaleString()} خط
            </p>
          </div>
        </div>

        {/* Actions + Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {canEdit && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <PlusCircle className="w-4 h-4" /> إضافة حالة
            </button>
          )}

          {/* Filter بالشبكة */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Network className="w-4 h-4 text-slate-400 shrink-0" />
            <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
              className="text-sm text-slate-700 bg-transparent focus:outline-none pr-1">
              <option value="">كل الشبكات</option>
              {providers.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">إجمالي الحالات</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{filtered.length}</p>
              </div>
              <span className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-600" />
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">إجمالي الخطوط</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalLines.toLocaleString()}</p>
              </div>
              <span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Hash className="w-5 h-5 text-blue-600" />
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">أكثر حالة</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5 truncate max-w-[120px]">
                  {filtered.sort((a, b) => (b._count || 0) - (a._count || 0))[0]?.name || "—"}
                </p>
              </div>
              <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">حالات بدون خطوط</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {filtered.filter((s) => !s._count).length}
                </p>
              </div>
              <span className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-600" />
              </span>
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            لا توجد حالات
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {filtered
              .sort((a, b) => (b._count || 0) - (a._count || 0))
              .map((status, i) => {
                const color = CARD_COLORS[i % CARD_COLORS.length];
                const percent = totalLines > 0 ? Math.round(((status._count || 0) / totalLines) * 100) : 0;

                return (
                  <div key={status.id}
                    className={`${color.bg} border ${color.border} rounded-2xl p-4 relative group transition hover:shadow-md`}>

                    {/* Actions */}
                    {canEdit && (
                      <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(status)}
                          className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm hover:bg-green-50 text-green-600 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {isSuperAdmin && (
                          <button onClick={() => deleteStatus(status.id)}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm hover:bg-red-50 text-red-600 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Provider badge */}
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-white/70 px-2 py-0.5 rounded-full mb-3 text-slate-500">
                      <Network className="w-3 h-3" />
                      {status.providers?.name || "—"}
                    </span>

                    {/* Status name */}
                    <p className={`text-sm font-semibold ${color.text} mb-3 leading-tight`}>
                      {status.name}
                    </p>

                    {/* Count */}
                    <p className={`text-3xl font-bold ${color.count}`}>
                      {(status._count || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">خط</p>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color.count.replace("text-", "bg-")}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{percent}% من الإجمالي</p>
                  </div>
                );
              })}
          </div>
        )}

        {/* Table view */}
        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">جدول الحالات</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium">الحالة</th>
                  <th className="p-3 text-right font-medium">الشبكة</th>
                  <th className="p-3 text-right font-medium">عدد الخطوط</th>
                  <th className="p-3 text-right font-medium">النسبة</th>
                  {canEdit && <th className="p-3 text-center font-medium">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {filtered
                  .sort((a, b) => (b._count || 0) - (a._count || 0))
                  .map((status, i) => {
                    const color = CARD_COLORS[i % CARD_COLORS.length];
                    const percent = totalLines > 0
                      ? Math.round(((status._count || 0) / totalLines) * 100)
                      : 0;

                    return (
                      <tr key={status.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                            {status.name}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{status.providers?.name || "—"}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {(status._count || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${color.count.replace("text-", "bg-")}`}
                                style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-xs text-slate-400 w-8 text-left">{percent}%</span>
                          </div>
                        </td>
                        {canEdit && (
                          <td className="p-3">
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => openEdit(status)}
                                className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                                <Pencil className="w-4 h-4" />
                              </button>
                              {isSuperAdmin && (
                                <button onClick={() => deleteStatus(status.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "تعديل الحالة" : "إضافة حالة جديدة"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الشبكة *</label>
                <select value={form.provider_id}
                  onChange={(e) => setForm((p) => ({ ...p, provider_id: e.target.value }))}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="">اختر الشبكة</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">اسم الحالة *</label>
                <input value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="اسم الحالة"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? "حفظ التعديلات" : "إضافة"}
              </button>
              <button onClick={() => setModalOpen(false)}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}