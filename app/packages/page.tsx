"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  PlusCircle, Pencil, Trash2, Upload, Download,
  Loader2, X, Check, ChevronDown, Package,
} from "lucide-react";

type PackageType = "مكالمات" | "نت" | "خدمة";
type ModalMode = "add" | "edit" | null;

const TABLE_MAP: Record<string, string> = {
  مكالمات: "calls_packages",
  نت: "internet_packages",
  خدمة: "line_extensions",
};

const NAME_FIELD: Record<string, string> = {
  مكالمات: "package_name",
  نت: "package_name",
  خدمة: "extension_name",
};

const EMPTY_FORM = { provider_id: "", name: "", price: "", type: "مكالمات" as PackageType };

export default function PackagesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [packages, setPackages] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // فلاتر
  const [filterProvider, setFilterProvider] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modal إضافة/تعديل
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<PackageType>("مكالمات");
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"add" | "update">("add");
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const r = localStorage.getItem("role") || "";
    setRole(r);
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const canEdit = isSuperAdmin || isAdmin;

  // ─── Load ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: p }, { data: calls }, { data: internet }, { data: ext }] = await Promise.all([
        supabase.from("providers").select("*"),
        supabase.from("calls_packages").select("*, providers(name)"),
        supabase.from("internet_packages").select("*, providers(name)"),
        supabase.from("line_extensions").select("*, providers(name)"),
      ]);

      setProviders(p || []);

      const all = [
        ...(calls || []).map((x) => ({ ...x, _type: "مكالمات" as PackageType, _name: x.package_name, _table: "calls_packages", _provider_name: x.providers?.name })),
        ...(internet || []).map((x) => ({ ...x, _type: "نت" as PackageType, _name: x.package_name, _table: "internet_packages", _provider_name: x.providers?.name })),
        ...(ext || []).map((x) => ({ ...x, _type: "خدمة" as PackageType, _name: x.extension_name, _table: "line_extensions", _provider_name: x.providers?.name })),
      ];
      setPackages(all);
      setLoading(false);
    }
    load();
  }, []);

  // ─── Filter ───────────────────────────────────────────────
  const filtered = packages.filter((x) => {
    const provMatch = !filterProvider || String(x.provider_id) === filterProvider;
    const typeMatch = !filterType || x._type === filterType;
    return provMatch && typeMatch;
  });

  // ─── Modal ────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingItem(null);
    setModalMode("add");
  }

  function openEdit(item: any) {
    setForm({
      provider_id: String(item.provider_id || ""),
      name: item._name || "",
      price: String(item.price || ""),
      type: item._type,
    });
    setEditingItem(item);
    setModalMode("edit");
  }

  async function savePackage() {
    if (!form.provider_id || !form.name || !form.price) {
      alert("الشبكة والاسم والسعر مطلوبين"); return;
    }
    setSaving(true);

    const table = TABLE_MAP[form.type];
    const nameField = NAME_FIELD[form.type];
    const payload = {
      provider_id: Number(form.provider_id),
      [nameField]: form.name.trim(),
      price: Number(form.price),
    };

    if (modalMode === "add") {
      const { error } = await supabase.from(table).insert(payload);
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from(editingItem._table).update(payload).eq("id", editingItem.id);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalMode(null);
    // reload
    const [{ data: calls }, { data: internet }, { data: ext }] = await Promise.all([
      supabase.from("calls_packages").select("*, providers(name)"),
      supabase.from("internet_packages").select("*, providers(name)"),
      supabase.from("line_extensions").select("*, providers(name)"),
    ]);
    setPackages([
      ...(calls || []).map((x) => ({ ...x, _type: "مكالمات" as PackageType, _name: x.package_name, _table: "calls_packages", _provider_name: x.providers?.name })),
      ...(internet || []).map((x) => ({ ...x, _type: "نت" as PackageType, _name: x.package_name, _table: "internet_packages", _provider_name: x.providers?.name })),
      ...(ext || []).map((x) => ({ ...x, _type: "خدمة" as PackageType, _name: x.extension_name, _table: "line_extensions", _provider_name: x.providers?.name })),
    ]);
  }

  async function deletePackage(item: any) {
    if (!confirm("هل أنت متأكد من حذف الباقة؟")) return;
    await supabase.from(item._table).delete().eq("id", item.id);
    setPackages((prev) => prev.filter((x) => !(x.id === item.id && x._table === item._table)));
  }

  // ─── Import ───────────────────────────────────────────────
  async function runImport() {
    if (!importFile) { alert("اختاري ملف Excel أولاً"); return; }
    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      const table = TABLE_MAP[importType];
      const nameField = NAME_FIELD[importType];

      const records = rows
        .filter((r) => r["name"] || r[nameField])
        .map((r) => ({
          provider_id: Number(r["provider_id"]),
          [nameField]: String(r["name"] || r[nameField] || "").trim(),
          price: Number(r["price"] || 0),
        }));

      if (importMode === "add") {
        // إضافة مجمعة
        for (let i = 0; i < records.length; i += 100) {
          const batch = records.slice(i, i + 100);
          const { error } = await supabase.from(table).insert(batch);
          if (error) throw new Error(error.message);
          setImportProgress(Math.round((Math.min(i + 100, records.length) / records.length) * 100));
        }
        setImportResult({ status: "success", message: `تم إضافة ${records.length} باقة بنجاح` });
      } else {
        // تغيير مجمع — بيتطابق على provider_id + name
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          await supabase.from(table)
            .update({ price: r.price })
            .eq("provider_id", r.provider_id)
            .eq(nameField, r[nameField]);
          setImportProgress(Math.round(((i + 1) / records.length) * 100));
        }
        setImportResult({ status: "success", message: `تم تحديث ${records.length} باقة بنجاح` });
      }

      // reload
      const [{ data: calls }, { data: internet }, { data: ext }] = await Promise.all([
        supabase.from("calls_packages").select("*, providers(name)"),
        supabase.from("internet_packages").select("*, providers(name)"),
        supabase.from("line_extensions").select("*, providers(name)"),
      ]);
      setPackages([
        ...(calls || []).map((x) => ({ ...x, _type: "مكالمات" as PackageType, _name: x.package_name, _table: "calls_packages", _provider_name: x.providers?.name })),
        ...(internet || []).map((x) => ({ ...x, _type: "نت" as PackageType, _name: x.package_name, _table: "internet_packages", _provider_name: x.providers?.name })),
        ...(ext || []).map((x) => ({ ...x, _type: "خدمة" as PackageType, _name: x.extension_name, _table: "line_extensions", _provider_name: x.providers?.name })),
      ]);
    } catch (err) {
      setImportResult({ status: "error", message: err instanceof Error ? err.message : "خطأ غير متوقع" });
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([{
      provider_id: 1,
      name: "اسم الباقة",
      price: 100,
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Packages");
    XLSX.writeFile(wb, "packages-template.xlsx");
  }

  if (!authorized) return null;

  const typeColors: Record<string, string> = {
    مكالمات: "bg-blue-50 text-blue-700",
    نت: "bg-green-50 text-green-700",
    خدمة: "bg-purple-50 text-purple-700",
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة الباقات والخدمات</h1>
            <p className="text-sm text-slate-500 mt-0.5">{packages.length} باقة وخدمة</p>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex flex-wrap gap-3 mb-5">
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
              <PlusCircle className="w-4 h-4" /> إضافة باقة
            </button>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-medium text-sm transition">
              <Download className="w-4 h-4" /> تحميل Template
            </button>
          </div>
        )}

        {/* Import section */}
        {canEdit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">استيراد مجمع من Excel</p>
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              {/* نوع الباقة */}
              <select value={importType} onChange={(e) => setImportType(e.target.value as PackageType)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50">
                <option value="مكالمات">باقات المكالمات</option>
                <option value="نت">باقات الإنترنت</option>
                <option value="خدمة">الخدمات</option>
              </select>

              {/* نوع العملية */}
              <select value={importMode} onChange={(e) => setImportMode(e.target.value as "add" | "update")}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50">
                <option value="add">إضافة مجمعة</option>
                <option value="update">تغيير مجمع (تحديث سعر)</option>
              </select>

              {/* ملف */}
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-3 py-2.5 cursor-pointer text-sm transition ${importFile ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 hover:border-blue-300 text-slate-400"}`}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{importFile ? importFile.name : "اختر ملف .xlsx"}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
              </label>

              {/* زرار */}
              <button onClick={runImport} disabled={importing || !importFile}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importMode === "add" ? "رفع" : "تحديث"}
              </button>
            </div>

            {/* Progress */}
            {importing && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>جارٍ التنفيذ...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${importResult.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {importResult.status === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {importResult.message}
              </div>
            )}

            <p className="text-xs text-slate-400 mt-2">
              الأعمدة: <strong>provider_id</strong> + <strong>name</strong> + <strong>price</strong>
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid md:grid-cols-2 gap-3">
            <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 bg-slate-50">
              <option value="">كل الشبكات</option>
              {providers.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 bg-slate-50">
              <option value="">كل الأنواع</option>
              <option value="مكالمات">باقات المكالمات</option>
              <option value="نت">باقات الإنترنت</option>
              <option value="خدمة">الخدمات</option>
            </select>
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
                  <th className="p-3 text-right font-medium">الشبكة</th>
                  <th className="p-3 text-right font-medium">النوع</th>
                  <th className="p-3 text-right font-medium">اسم الباقة</th>
                  <th className="p-3 text-right font-medium">السعر</th>
                  {canEdit && <th className="p-3 text-center font-medium">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {filtered.map((item) => (
                  <tr key={`${item._table}-${item.id}`}
                    className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 font-medium">{item._provider_name || item.provider_id}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[item._type]}`}>
                        {item._type}
                      </span>
                    </td>
                    <td className="p-3">{item._name}</td>
                    <td className="p-3 font-semibold">{item.price}</td>
                    {canEdit && (
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => openEdit(item)}
                            className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => deletePackage(item)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">لا توجد باقات</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal إضافة/تعديل */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {modalMode === "add" ? "إضافة باقة جديدة" : "تعديل الباقة"}
              </h2>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* النوع */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">نوع الباقة</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as PackageType }))}
                  disabled={modalMode === "edit"}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60">
                  <option value="مكالمات">باقة مكالمات</option>
                  <option value="نت">باقة إنترنت</option>
                  <option value="خدمة">خدمة</option>
                </select>
              </div>

              {/* الشبكة */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الشبكة</label>
                <select value={form.provider_id} onChange={(e) => setForm((p) => ({ ...p, provider_id: e.target.value }))}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">اختر الشبكة</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* الاسم */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">اسم الباقة</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="اسم الباقة"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              {/* السعر */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">السعر</label>
                <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  placeholder="السعر"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={savePackage} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === "add" ? "إضافة" : "حفظ التعديلات"}
              </button>
              <button onClick={() => setModalMode(null)}
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