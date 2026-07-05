"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Building2, PlusCircle, Search, Pencil, Trash2, Loader2,
  Download, Upload, X, Check, ChevronLeft, ChevronRight,
  Network, Hash, FileSpreadsheet, BarChart2,
} from "lucide-react";
import SortableTable from "@/app/components/SortableTable";

interface Account {
  id: number;
  account_no: string;
  account_name: string;
  provider_id: number;
  created_at: string;
  providers?: { name: string };
  _lines_count?: number;
}

const EMPTY_FORM = { account_no: "", account_name: "", provider_id: "" };
const PAGE_SIZE = 50;

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "اتصالات": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "اورنج":   { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "فودافون": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};
const DEFAULT_COLOR = { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };

function getProviderColor(name: string) {
  return PROVIDER_COLORS[name] || DEFAULT_COLOR;
}

export default function AccountsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [dashStats, setDashStats] = useState<{
    totalAccounts: number;
    totalLines: number;
    byProvider: { name: string; accounts: number; lines: number }[];
    topAccounts: { account_no: string; account_name: string; provider: string; count: number }[];
  }>({ totalAccounts: 0, totalLines: 0, byProvider: [], topAccounts: [] });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const canEdit = isSuperAdmin || isAdmin;

  useEffect(() => {
    const r = localStorage.getItem("role") || "";
    setRole(r);
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    supabase.from("providers").select("*").then(({ data }) => setProviders(data || []));
  }, []);

  // ─── Load accounts ────────────────────────────────────────
  async function loadAccounts() {
    setLoading(true);

    let query = supabase
      .from("accounts")
      .select("*, providers(name)", { count: "exact" })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search.trim())
      query = query.or(`account_no.ilike.%${search}%,account_name.ilike.%${search}%`);
    if (filterProvider)
      query = query.eq("provider_id", Number(filterProvider));

    const { data, count, error } = await query;
    if (error) { setLoading(false); return; }

    const accountIds = (data || []).map((a) => a.id);

    // جيبي عدد الخطوط لكل أكونت
    const countMap = new Map<number, number>();
    if (accountIds.length > 0) {
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: linesData } = await supabase
          .from("lines")
          .select("account_id")
          .in("account_id", accountIds)
          .or("is_deleted.is.null,is_deleted.eq.false")
          .range(offset, offset + batchSize - 1);

        (linesData || []).forEach((l) => {
          if (l.account_id)
            countMap.set(l.account_id, (countMap.get(l.account_id) || 0) + 1);
        });

        if (!linesData || linesData.length < batchSize) break;
        offset += batchSize;
      }
    }

    setAccounts((data || []).map((a) => ({ ...a, _lines_count: countMap.get(a.id) || 0 })));
    setTotal(count || 0);
    setLoading(false);
  }

  // ─── Load dashboard ───────────────────────────────────────
  async function loadDashStats() {
    const { data: allAccounts } = await supabase
      .from("accounts")
      .select("id, account_no, account_name, provider_id, providers(name)");

    // إجمالي الخطوط الفعلي
    const { count: totalLinesCount } = await supabase
      .from("lines")
      .select("*", { count: "exact", head: true })
      .or("is_deleted.is.null,is_deleted.eq.false");

    // عدد الخطوط لكل أكونت — بنجيبها في batches
    const lineCountMap = new Map<number, number>();
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch } = await supabase
        .from("lines")
        .select("account_id")
        .not("account_id", "is", null)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .range(offset, offset + batchSize - 1);

      (batch || []).forEach((l) => {
        if (l.account_id)
          lineCountMap.set(l.account_id, (lineCountMap.get(l.account_id) || 0) + 1);
      });

      if (!batch || batch.length < batchSize) break;
      offset += batchSize;
    }

    const providerMap = new Map<string, { accounts: number; lines: number }>();
    (allAccounts || []).forEach((a: any) => {
      const name = a.providers?.name || "غير محدد";
      if (!providerMap.has(name)) providerMap.set(name, { accounts: 0, lines: 0 });
      const p = providerMap.get(name)!;
      p.accounts++;
      p.lines += lineCountMap.get(a.id) || 0;
    });

    const topAccounts = (allAccounts || [])
      .map((a: any) => ({
        account_no: a.account_no,
        account_name: a.account_name || "—",
        provider: a.providers?.name || "—",
        count: lineCountMap.get(a.id) || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setDashStats({
      totalAccounts: allAccounts?.length || 0,
      totalLines: totalLinesCount || 0,
      byProvider: [...providerMap.entries()].map(([name, v]) => ({ name, ...v })),
      topAccounts,
    });
  }

  useEffect(() => { loadAccounts(); loadDashStats(); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadAccounts(), 300);
    return () => clearTimeout(t);
  }, [search, filterProvider, page]);

  // ─── Modal ────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM, provider_id: filterProvider });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(account: Account) {
    setForm({
      account_no: account.account_no,
      account_name: account.account_name || "",
      provider_id: String(account.provider_id || ""),
    });
    setEditingId(account.id);
    setModalOpen(true);
  }

  async function save() {
    if (!form.account_no.trim()) { alert("رقم الأكونت مطلوب"); return; }
    if (!form.provider_id) { alert("الشبكة مطلوبة"); return; }
    setSaving(true);

    const payload = {
      account_no: form.account_no.trim(),
      account_name: form.account_name.trim() || null,
      provider_id: Number(form.provider_id),
    };

    if (editingId) {
      const { error } = await supabase.from("accounts").update(payload).eq("id", editingId);
      if (error) { alert(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("accounts").insert(payload);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalOpen(false);
    loadAccounts();
    loadDashStats();
  }

  async function deleteAccount(id: number) {
    if (!confirm("هل أنت متأكد من حذف الأكونت؟")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    loadAccounts();
    loadDashStats();
  }

  // ─── Import ───────────────────────────────────────────────
  async function importFromExcel() {
    if (!importFile) { alert("اختاري ملف Excel أولاً"); return; }
    setImporting(true);
    setImportProgress(0);
    setImportText("جارٍ قراءة الملف...");
    setImportResult(null);

    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      const providerCache = new Map<string, number>();
      providers.forEach((p) => providerCache.set(p.name.toLowerCase(), p.id));

      const records = rows
        .filter((r) => r["account_no"] || r["رقم الأكونت"])
        .map((r) => {
          const providerName = String(r["provider_name"] || r["الشبكة"] || "").trim();
          const provider_id = providerCache.get(providerName.toLowerCase()) || null;
          return {
            account_no: String(r["account_no"] || r["رقم الأكونت"] || "").trim(),
            account_name: String(r["account_name"] || r["اسم الأكونت"] || "").trim() || null,
            provider_id,
          };
        })
        .filter((r) => r.account_no && r.provider_id);

      // شيلي المكررين
      const unique = Array.from(
        new Map(records.map((r) => [r.account_no, r])).values()
      );
      const dupes = records.length - unique.length;

      setImportText(`جارٍ رفع ${unique.length} أكونت...`);

      let uploaded = 0;
      for (let i = 0; i < unique.length; i += 500) {
        const batch = unique.slice(i, i + 500);
        const { error } = await supabase.from("accounts").upsert(batch, {
          onConflict: "account_no",
          ignoreDuplicates: false,
        });
        if (error) throw new Error(error.message);
        uploaded = Math.min(i + 500, unique.length);
        setImportProgress(Math.round((uploaded / unique.length) * 100));
        setImportText(`تم رفع ${uploaded} من ${unique.length}...`);
      }

      setImportResult({
        status: "success",
        message: `تم استيراد ${unique.length} أكونت بنجاح${dupes > 0 ? ` (تم تجاهل ${dupes} مكرر)` : ""}`,
      });
      loadAccounts();
      loadDashStats();
    } catch (err) {
      setImportResult({
        status: "error",
        message: err instanceof Error ? err.message : "خطأ غير متوقع",
      });
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  }

  if (!authorized) return null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة الأكونتات</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {dashStats.totalAccounts.toLocaleString()} أكونت — {dashStats.totalLines.toLocaleString()} خط
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">إجمالي الأكونتات</p>
              <p className="text-3xl font-bold text-slate-900 mt-0.5">{dashStats.totalAccounts.toLocaleString()}</p>
            </div>
            <span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">إجمالي الخطوط</p>
              <p className="text-3xl font-bold text-slate-900 mt-0.5">{dashStats.totalLines.toLocaleString()}</p>
            </div>
            <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Hash className="w-5 h-5 text-green-600" />
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">متوسط خطوط/أكونت</p>
              <p className="text-3xl font-bold text-slate-900 mt-0.5">
                {dashStats.totalAccounts > 0
                  ? (dashStats.totalLines / dashStats.totalAccounts).toFixed(1)
                  : "0"}
              </p>
            </div>
            <span className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-purple-600" />
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">عدد الشبكات</p>
              <p className="text-3xl font-bold text-slate-900 mt-0.5">{providers.length}</p>
            </div>
            <span className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Network className="w-5 h-5 text-orange-600" />
            </span>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {dashStats.byProvider.map((p) => {
            const color = getProviderColor(p.name);
            const avgLines = p.accounts > 0 ? (p.lines / p.accounts).toFixed(1) : "0";
            const percent = dashStats.totalAccounts > 0
              ? Math.round((p.accounts / dashStats.totalAccounts) * 100)
              : 0;
            return (
              <div key={p.name} className={`${color.bg} border ${color.border} rounded-2xl p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-bold ${color.text}`}>{p.name}</span>
                  <span className={`text-xs font-medium ${color.text} bg-white/60 px-2 py-0.5 rounded-full`}>
                    {percent}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className={`text-2xl font-bold ${color.text}`}>{p.accounts.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-0.5">أكونت</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${color.text}`}>{p.lines.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-0.5">خط</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${color.text}`}>{avgLines}</p>
                    <p className="text-xs text-slate-500 mt-0.5">متوسط</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color.text.replace("text-", "bg-")}`}
                    style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top 5 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            أكتر 5 أكونتات خطوط
          </h2>
          <div className="space-y-2">
            {dashStats.topAccounts.map((a, i) => {
              const color = getProviderColor(a.provider);
              const maxCount = dashStats.topAccounts[0]?.count || 1;
              const width = Math.round((a.count / maxCount) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {a.account_no}
                        {a.account_name !== "—" && (
                          <span className="text-xs text-slate-400 mr-1">({a.account_name})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                          {a.provider}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{a.count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${width}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-5">
          {canEdit && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <PlusCircle className="w-4 h-4" /> إضافة أكونت
            </button>
          )}
        </div>

        {/* Import */}
        {canEdit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              استيراد مجمع من Excel
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition text-sm ${
                importFile ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 hover:border-blue-300 text-slate-400"
              }`}>
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {importFile ? importFile.name : "اختر ملف .xlsx"}
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
              </label>
              <button onClick={importFromExcel} disabled={importing || !importFile}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
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
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}

            {importResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
                importResult.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {importResult.status === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {importResult.message}
              </div>
            )}

            <p className="text-xs text-slate-400 mt-2">
              الأعمدة: <strong>account_no</strong> + <strong>account_name</strong> + <strong>provider_name</strong>
            </p>
          </div>
        )}

        {/* Search + Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="بحث برقم الأكونت أو الاسم"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <select value={filterProvider} onChange={(e) => { setFilterProvider(e.target.value); setPage(1); }}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">كل الشبكات</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div>
            <SortableTable
              columns={[
                { key: "account_no", label: "رقم الأكونت", className: "font-mono font-medium text-slate-900" },
                { key: "account_name", label: "اسم الأكونت", className: "text-slate-600" },
                { label: "الشبكة", render: (a) => {
                  const color = getProviderColor(a.providers?.name || "");
                  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>{a.providers?.name || "—"}</span>;
                }},
                { key: "_lines_count", label: "عدد الخطوط", className: "font-bold text-slate-900" },
                { key: "created_at", label: "تاريخ الإضافة", render: (a) => new Date(a.created_at).toLocaleDateString("ar-EG") },
              ]}
              data={accounts}
              actions={(account) => (
                <>
                  <button onClick={() => openEdit(account)}
                    className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => deleteAccount(account.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            />

            <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
              <span className="text-xs text-slate-400">{total.toLocaleString()} نتيجة</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> السابق
                </button>
                <span className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  التالي <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "تعديل الأكونت" : "إضافة أكونت جديد"}
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
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">اختر الشبكة</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">رقم الأكونت *</label>
                <input value={form.account_no}
                  onChange={(e) => setForm((p) => ({ ...p, account_no: e.target.value }))}
                  placeholder="رقم الأكونت"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">اسم الأكونت</label>
                <input value={form.account_name}
                  onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))}
                  placeholder="اسم الأكونت"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
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