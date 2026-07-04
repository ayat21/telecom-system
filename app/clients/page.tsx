"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Users, PlusCircle, Search, Pencil, Trash2, Loader2,
  Download, Upload, X, Check, ChevronLeft, ChevronRight,
  User, IdCard, MapPin, ImagePlus, FileSpreadsheet,
} from "lucide-react";

interface Client {
  id: number;
  name: string;
  national_id: string;
  address: string;
  national_id_image: string;
  created_at: string;
}

const EMPTY_FORM = {
  name: "",
  national_id: "",
  address: "",
  national_id_image: "",
};

const PAGE_SIZE = 50;

export default function ClientsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ─── Modal ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── Import ───────────────────────────────────────────────
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";

  // ─── Auth ─────────────────────────────────────────────────
  useEffect(() => {
    const r = localStorage.getItem("role") || "";
    setRole(r);
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Load clients ─────────────────────────────────────────
  async function loadClients() {
    setLoading(true);

    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search.trim())
      query = query.or(`name.ilike.%${search}%,national_id.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (!error) {
      setClients(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  useEffect(() => { loadClients(); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadClients(), 300);
    return () => clearTimeout(t);
  }, [search, page]);

  // ─── Modal helpers ────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id);
    setForm({
      name: client.name || "",
      national_id: client.national_id || "",
      address: client.address || "",
      national_id_image: client.national_id_image || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  // ─── Save (add/edit) ──────────────────────────────────────
  async function save() {
    if (!form.name.trim()) { alert("اسم العميل مطلوب"); return; }
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      national_id: form.national_id.trim() || null,
      address: form.address.trim() || null,
      national_id_image: form.national_id_image.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    setSaving(false);
    closeModal();
    loadClients();
  }

  // ─── Delete ───────────────────────────────────────────────
  async function deleteClient(id: number) {
    if (!confirm("هل أنت متأكد من حذف العميل؟")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    loadClients();
  }

  // ─── Import from Excel ────────────────────────────────────
async function importFromExcel() {
  if (!importFile) { alert("اختاري ملف Excel أولاً"); return; }
  setImporting(true);
  setImportProgress(0);
  setImportText("جارٍ قراءة الملف...");
  setImportResult(null);

  try {
    const buffer = await importFile.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

    const records = rows
      .filter((r) => r["name"] || r["اسم العميل"])
      .map((r) => ({
        name: String(r["name"] || r["اسم العميل"] || "").trim(),
        national_id: String(r["national_id"] || r["الرقم القومي"] || "").trim() || null,
        address: String(r["address"] || r["العنوان"] || "").trim() || null,
        national_id_image: String(r["national_id_image"] || "").trim() || null,
      }));

    // افصل السجلات: اللي عندها national_id واللي معندهاش
    const withNationalId = records.filter((r) => r.national_id);
    const withoutNationalId = records.filter((r) => !r.national_id);

    setImportText(`جارٍ رفع ${records.length} عميل...`);
    let uploaded = 0;

    // اللي عندها national_id → upsert (تجنب تكرار)
    for (let i = 0; i < withNationalId.length; i += 500) {
      const batch = withNationalId.slice(i, i + 500);
      const { error } = await supabase.from("clients").upsert(batch, {
        onConflict: "national_id",
        ignoreDuplicates: false,
      });
      if (error) throw new Error(error.message);
      uploaded += batch.length;
      setImportProgress(Math.round((uploaded / records.length) * 100));
      setImportText(`تم رفع ${uploaded} من ${records.length}...`);
    }

    // اللي معندهاش national_id → insert عادي
    for (let i = 0; i < withoutNationalId.length; i += 500) {
      const batch = withoutNationalId.slice(i, i + 500);
      const { error } = await supabase.from("clients").insert(batch);
      if (error) throw new Error(error.message);
      uploaded += batch.length;
      setImportProgress(Math.round((uploaded / records.length) * 100));
      setImportText(`تم رفع ${uploaded} من ${records.length}...`);
    }

    setImportResult({ status: "success", message: `تم استيراد ${records.length} عميل بنجاح` });
    loadClients();
  } catch (err) {
    setImportResult({ status: "error", message: err instanceof Error ? err.message : "خطأ غير متوقع" });
  } finally {
    setImporting(false);
    setImportProgress(0);
    setImportText("");
    setImportFile(null);
  }
}

  // ─── Export template ──────────────────────────────────────
  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([{
      name: "محمد أحمد",
      national_id: "12345678901234",
      address: "القاهرة",
      national_id_image: "",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, "clients-template.xlsx");
  }

  if (!authorized) return null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-purple-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة العملاء</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              إجمالي {total.toLocaleString()} عميل
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-5">
          {(isSuperAdmin || isAdmin) && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 transition text-white px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm">
              <PlusCircle className="w-4 h-4" /> إضافة عميل
            </button>
          )}
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm">
            <Download className="w-4 h-4" /> تحميل Template
          </button>
        </div>

        {/* Import section */}
        {(isSuperAdmin || isAdmin) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              استيراد مجمع من Excel
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition text-sm ${importFile ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 hover:border-purple-300 text-slate-400"}`}>
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {importFile ? importFile.name : "اختر ملف .xlsx"}
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
              </label>
              <button onClick={importFromExcel} disabled={importing || !importFile}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                استيراد
              </button>
            </div>

            {importing && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{importText}</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}

            {importResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${importResult.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {importResult.status === "success"
                  ? <Check className="w-4 h-4 shrink-0" />
                  : <X className="w-4 h-4 shrink-0" />}
                {importResult.message}
              </div>
            )}

            <p className="text-xs text-slate-400 mt-2">
              الأعمدة المطلوبة: <strong>name</strong> أو <strong>اسم العميل</strong> — اختياري: national_id, address, national_id_image
            </p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم أو الرقم القومي"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300" />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium">#</th>
                  <th className="p-3 text-right font-medium">الاسم</th>
                  <th className="p-3 text-right font-medium">الرقم القومي</th>
                  <th className="p-3 text-right font-medium">العنوان</th>
                  <th className="p-3 text-right font-medium">تاريخ الإضافة</th>
                  {(isSuperAdmin || isAdmin) && (
                    <th className="p-3 text-center font-medium">إجراءات</th>
                  )}
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 text-slate-400 text-xs">{client.id}</td>
                    <td className="p-3 font-medium text-slate-900">{client.name}</td>
                    <td className="p-3 text-slate-500 font-mono text-xs">{client.national_id || "—"}</td>
                    <td className="p-3 text-slate-500">{client.address || "—"}</td>
                    <td className="p-3 text-slate-400 text-xs">
                      {new Date(client.created_at).toLocaleDateString("ar-EG")}
                    </td>
                    {(isSuperAdmin || isAdmin) && (
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => openEdit(client)} title="تعديل"
                            className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => deleteClient(client.id)} title="حذف"
                              className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      لا يوجد عملاء
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
              <span className="text-xs text-slate-400">{total.toLocaleString()} نتيجة</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> السابق
                </button>
                <span className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-sm">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  التالي <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal إضافة/تعديل */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* الاسم */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">اسم العميل *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="اسم العميل"
                    className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
              </div>

              {/* الرقم القومي */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الرقم القومي</label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={form.national_id} onChange={(e) => setForm((p) => ({ ...p, national_id: e.target.value }))}
                    placeholder="الرقم القومي"
                    className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
              </div>

              {/* العنوان */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">العنوان</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="العنوان"
                    className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
              </div>

              {/* صورة البطاقة */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">رابط صورة البطاقة</label>
                <div className="relative">
                  <ImagePlus className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={form.national_id_image} onChange={(e) => setForm((p) => ({ ...p, national_id_image: e.target.value }))}
                    placeholder="رابط الصورة"
                    className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? "حفظ التعديلات" : "إضافة العميل"}
              </button>
              <button onClick={closeModal}
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