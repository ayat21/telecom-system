"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  CreditCard, Upload, Download, Search, Calendar,
  Loader2, Check, X, FileSpreadsheet, ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 50;

// الأقسام المستبعدة لما "كل الأقسام" مختارة
const EXCLUDED_DEPARTMENTS = ["SPOC", "فوري", "", "هيثم"];

export default function PaymentsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalCount: 0,
    totalAmount: 0,
    monthCount: 0,
    monthCollected: 0,
    monthRequired: 0,
    monthUnpaid: 0,
    collectionRate: 0,
  });

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonth, setImportMonth] = useState("");
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
    supabase.from("departments").select("id, name").order("name")
      .then(({ data }) => setDepartmentsList(data || []));
  }, []);

  // ─── Load payments ────────────────────────────────────────
  async function loadPayments() {
    setLoading(true);

    let query = supabase
      .from("payments")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search.trim())
      query = query.or(`line_number.ilike.%${search}%,billing_account_number.ilike.%${search}%`);
    if (filterMonth)
      query = query.eq("payment_month", filterMonth);
    if (filterCode)
      query = query.eq("payment_code", filterCode);

    const { data, count } = await query;
    setPayments(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  function parseExcelDate(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const parts = str.split("/");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const num = Number(value);
    if (!isNaN(num) && num > 1000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  // ─── Load stats ───────────────────────────────────────────
  async function loadStats() {
    // إجمالي الكل (كل الوقت)
    const { count: totalCount } = await supabase
      .from("payments").select("*", { count: "exact", head: true });

    let totalAmount = 0;
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("payments")
        .select("amount").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      totalAmount += data.reduce((s, p) => s + (p.amount || 0), 0);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // ─── إحصائيات الشهر المفلتر ─────────────────────────
    let monthCollected = 0;   // المحصل فعلاً
    let monthRequired = 0;    // المطلوب (من الخطوط)
    let monthCount = 0;       // عدد السدادات

    if (filterMonth) {
      // 1. المحصل — من جدول payments
      const { count } = await supabase
        .from("payments").select("*", { count: "exact", head: true })
        .eq("payment_month", filterMonth);
      monthCount = count || 0;

      let mOffset = 0;
      while (true) {
        const { data } = await supabase.from("payments")
          .select("amount").eq("payment_month", filterMonth)
          .range(mOffset, mOffset + 999);
        if (!data || data.length === 0) break;
        monthCollected += data.reduce((s, p) => s + (p.amount || 0), 0);
        if (data.length < 1000) break;
        mOffset += 1000;
      }

      // 2. المطلوب — إجمالي total_price حسب فلتر القسم
      let lineQuery = supabase
        .from("lines")
        .select("total_price, departments(name)")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .not("department_id", "is", null);

      if (filterDepartment) {
        lineQuery = lineQuery.eq("department_id", Number(filterDepartment));
      }

      let lOffset = 0;
      while (true) {
        const { data } = await lineQuery.range(lOffset, lOffset + 999);
        if (!data || data.length === 0) break;

        const filtered = filterDepartment
          ? data // لو مختار قسم معين، خديه زي ما هو
          : data.filter((l: any) => !EXCLUDED_DEPARTMENTS.includes(l.departments?.name || ""));

        monthRequired += filtered.reduce((s: number, l: any) => s + (l.total_price || 0), 0);
        if (data.length < 1000) break;
        lOffset += 1000;
      }
    }

    // الأكواد
    const { data: codesData } = await supabase
      .from("payments").select("payment_code").limit(10000);
    setCodes([...new Set((codesData || []).map((p) => p.payment_code).filter(Boolean))]);

    const monthUnpaid = monthRequired - monthCollected;
    const collectionRate = monthRequired > 0 ? (monthCollected / monthRequired) * 100 : 0;

    setStats({
      totalCount: totalCount || 0,
      totalAmount,
      monthCount,
      monthCollected,
      monthRequired,
      monthUnpaid: monthUnpaid > 0 ? monthUnpaid : 0,
      collectionRate,
    });
  }

  useEffect(() => { loadPayments(); loadStats(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { loadPayments(); loadStats(); }, 300);
    return () => clearTimeout(t);
  }, [search, filterMonth, filterCode, filterDepartment, page]);

  // ─── Import ───────────────────────────────────────────────
  async function importFromExcel() {
    if (!importFile) { alert("اختاري ملف Excel أولاً"); return; }
    if (!importMonth) { alert("اختاري شهر السداد أولاً"); return; }

    setImporting(true);
    setImportProgress(0);
    setImportText("جارٍ قراءة الملف...");
    setImportResult(null);

    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      const records = rows
        .filter((r) => String(r["number"] || "").trim())
        .map((r) => ({
          line_number: String(r["number"] || "").trim(),
          amount: Number(r["amount"] || 0),
          payment_code: String(r["payment_code"] || r["code"] || "").trim() || null,
          trans_date: parseExcelDate(r["trans_date"]),
          payment_month: importMonth,
        }));

      if (records.length === 0) throw new Error("مفيش سجلات صالحة في الملف");

      // ─── جيبي account_no من lines ─────────────────────────
      setImportText("جارٍ جلب أرقام الحسابات...");
      const allNumbers = [...new Set(records.map((r) => r.line_number))];
      const accountMap = new Map<string, string>();

      for (let i = 0; i < allNumbers.length; i += 1000) {
        const { data } = await supabase
          .from("lines")
          .select("number, accounts(account_no)")
          .in("number", allNumbers.slice(i, i + 1000));
        (data || []).forEach((l: any) => {
          if (l.accounts?.account_no)
            accountMap.set(l.number, l.accounts.account_no);
        });
      }

      const finalRecords = records.map((r) => ({
        ...r,
        billing_account_number: accountMap.get(r.line_number) || null,
      }));

      // ─── ارفعي ────────────────────────────────────────────
      setImportText(`جارٍ رفع ${finalRecords.length} سداد...`);
      let uploaded = 0;
      for (let i = 0; i < finalRecords.length; i += 500) {
        const batch = finalRecords.slice(i, i + 500);
        const { error } = await supabase.from("payments").insert(batch);
        if (error) throw new Error(error.message);
        uploaded = Math.min(i + 500, finalRecords.length);
        setImportProgress(Math.round((uploaded / finalRecords.length) * 100));
        setImportText(`تم رفع ${uploaded} من ${finalRecords.length}...`);
      }

      setImportResult({
        status: "success",
        message: `تم رفع ${finalRecords.length} سداد لشهر ${importMonth} بنجاح`,
      });
      loadPayments();
      loadStats();
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

  // ─── Export ───────────────────────────────────────────────
  async function exportToExcel() {
    let query = supabase.from("payments").select("*").order("id", { ascending: false });
    if (filterMonth) query = query.eq("payment_month", filterMonth);
    if (filterCode) query = query.eq("payment_code", filterCode);

    const { data } = await query.limit(100000);
    if (!data) return;

    const rows = data.map((p) => ({
      "رقم الخط": p.line_number,
      "رقم الحساب": p.billing_account_number,
      "المبلغ": p.amount,
      "طريقة السداد": p.payment_code,
      "شهر السداد": p.payment_month,
      "تاريخ العملية": p.trans_date,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المدفوعات");
    XLSX.writeFile(wb, `payments-${filterMonth || "all"}.xlsx`);
  }

  if (!authorized) return null;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 text-green-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">المدفوعات</h1>
            <p className="text-sm text-slate-500 mt-0.5">إدارة سدادات الخطوط الشهرية</p>
          </div>
        </div>

        {/* Department filter for stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <label className="block text-xs text-slate-500 mb-1.5">فلتر القسم (لحساب الإحصائيات)</label>
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full md:w-72 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200">
            <option value="">كل الأقسام (بدون SPOC، فوري، العهدة، هيثم)</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">إجمالي المطلوب (الشهر)</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {filterMonth ? stats.monthRequired.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-slate-400">جنيه</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">إجمالي المحصل (الشهر)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {filterMonth ? stats.monthCollected.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-slate-400">جنيه</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">إجمالي الغير مسدد</p>
            <p className="text-2xl font-bold text-red-500 mt-1">
              {filterMonth ? stats.monthUnpaid.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-slate-400">جنيه</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">نسبة التحصيل</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {filterMonth ? `${stats.collectionRate.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-slate-400">{stats.monthCount} سداد</p>
          </div>
        </div>

        {/* Import */}
        {canEdit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              رفع سدادات شهرية
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              {/* الشهر */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">سداد شهر *</label>
                <input type="month" value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
              </div>
              {/* الملف */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">ملف Excel *</label>
                <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-3 py-2.5 cursor-pointer transition text-sm ${
                  importFile ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 hover:border-green-300 text-slate-400"
                }`}>
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="truncate">{importFile ? importFile.name : "اختر ملف .xlsx"}</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
                </label>
              </div>
              {/* زرار */}
              <div className="flex items-end">
                <button onClick={importFromExcel} disabled={importing || !importFile || !importMonth}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  رفع السدادات
                </button>
              </div>
            </div>

            {importing && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{importText}</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
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
              الأعمدة: <span className="font-mono">number</span> (رقم الخط) + <span className="font-mono">amount</span> + <span className="font-mono">payment_code</span> (اختياري) + <span className="font-mono">trans_date</span> (اختياري) — رقم الحساب بيتجاب أوتوماتيك
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="بحث برقم الخط أو رقم الحساب"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <input type="month" value={filterMonth}
              onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200" />
            <div className="flex gap-2">
              <select value={filterCode} onChange={(e) => { setFilterCode(e.target.value); setPage(1); }}
                className="flex-1 border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200">
                <option value="">كل طرق السداد</option>
                {codes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <button onClick={exportToExcel}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2.5 rounded-xl text-sm transition shrink-0">
                <Download className="w-4 h-4" />
              </button>
            </div>
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
                  <th className="p-3 text-right font-medium">رقم الخط</th>
                  <th className="p-3 text-right font-medium">رقم الحساب</th>
                  <th className="p-3 text-right font-medium">المبلغ</th>
                  <th className="p-3 text-right font-medium">طريقة السداد</th>
                  <th className="p-3 text-right font-medium">شهر السداد</th>
                  <th className="p-3 text-right font-medium">تاريخ العملية</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-medium text-slate-900">{payment.line_number || "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-500">{payment.billing_account_number || "—"}</td>
                    <td className="p-3 font-bold text-green-600">{(payment.amount || 0).toLocaleString()} جنيه</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {payment.payment_code || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        {payment.payment_month || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-xs">{payment.trans_date || "—"}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">لا توجد سدادات</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
              <span className="text-xs text-slate-400">{total.toLocaleString()} سداد</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> السابق
                </button>
                <span className="px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-sm">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-40 text-sm font-medium">
                  التالي <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}