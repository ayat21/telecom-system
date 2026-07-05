"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  CreditCard, Upload, Download, Search, Filter,
  Calendar, Loader2, Check, X, FileSpreadsheet,
  ChevronLeft, ChevronRight, TrendingUp, DollarSign,
} from "lucide-react";

interface Payment {
  id: number;
  trans_date: string;
  trans_time: string;
  billing_account_number: string;
  amount: number;
  payment_code: string;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function PaymentsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState("");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Stats
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    todayAmount: 0,
    todayCount: 0,
  });

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  // Unique codes
  const [codes, setCodes] = useState<string[]>([]);

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const canEdit = isSuperAdmin || isAdmin;

  useEffect(() => {
    const r = localStorage.getItem("role") || "";
    setRole(r);
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Load payments ────────────────────────────────────────
  async function loadPayments() {
    setLoading(true);

    let query = supabase
      .from("payments")
      .select("*", { count: "exact" })
      .order("trans_date", { ascending: false })
      .order("trans_time", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search.trim())
      query = query.ilike("billing_account_number", `%${search}%`);
    if (filterCode)
      query = query.eq("payment_code", filterCode);
    if (fromDate)
      query = query.gte("trans_date", fromDate);
    if (toDate)
      query = query.lte("trans_date", toDate);

    const { data, count, error } = await query;
    if (!error) {
      setPayments(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  // ─── Load stats ───────────────────────────────────────────
  async function loadStats() {
    const today = new Date().toISOString().split("T")[0];

    const [{ data: all }, { data: todayData }, { data: codesData }] = await Promise.all([
      supabase.from("payments").select("amount"),
      supabase.from("payments").select("amount").eq("trans_date", today),
      supabase.from("payments").select("payment_code"),
    ]);

    const totalAmount = (all || []).reduce((s, p) => s + (p.amount || 0), 0);
    const todayAmount = (todayData || []).reduce((s, p) => s + (p.amount || 0), 0);

    // Unique codes
    const uniqueCodes = [...new Set((codesData || []).map((p) => p.payment_code).filter(Boolean))];
    setCodes(uniqueCodes);

    setStats({
      totalAmount,
      totalCount: all?.length || 0,
      todayAmount,
      todayCount: todayData?.length || 0,
    });
  }

  useEffect(() => { loadPayments(); loadStats(); }, []);
  useEffect(() => {
    const t = setTimeout(() => loadPayments(), 300);
    return () => clearTimeout(t);
  }, [search, filterCode, fromDate, toDate, page]);

  // ─── Import Excel ─────────────────────────────────────────
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

      // قراءة من الصف 9 (header) عشان الملف فيه rows فاضية في الأول
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        range: 8, // يبدأ من الصف 9
      }) as any[];

      const records = rows
        .filter((r) => r["BILLING ACCOUNT NUMBER"] || r["Amount"])
        .map((r) => ({
          trans_date: r["TRANS DATE"] ? String(r["TRANS DATE"]).trim() : null,
          trans_time: r["TRANS TIME"] ? String(r["TRANS TIME"]).trim() : null,
          billing_account_number: String(r["BILLING ACCOUNT NUMBER"] || "").trim(),
          amount: Number(r["Amount"] || 0),
          payment_code: String(r["CODE"] || "").trim(),
        }))
        .filter((r) => r.billing_account_number && r.amount > 0);

      setImportText(`جارٍ رفع ${records.length} معاملة...`);

      let uploaded = 0;
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500);
        const { error } = await supabase.from("payments").upsert(batch, {
          ignoreDuplicates: false,
        });
        if (error) throw new Error(error.message);
        uploaded = Math.min(i + 500, records.length);
        setImportProgress(Math.round((uploaded / records.length) * 100));
        setImportText(`تم رفع ${uploaded} من ${records.length}...`);
      }

      setImportResult({
        status: "success",
        message: `تم استيراد ${records.length} معاملة بنجاح`,
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

  // ─── Export Excel ─────────────────────────────────────────
  async function exportToExcel() {
    let query = supabase
      .from("payments")
      .select("*")
      .order("trans_date", { ascending: false });

    if (search.trim()) query = query.ilike("billing_account_number", `%${search}%`);
    if (filterCode) query = query.eq("payment_code", filterCode);
    if (fromDate) query = query.gte("trans_date", fromDate);
    if (toDate) query = query.lte("trans_date", toDate);

    const { data } = await query;
    if (!data) return;

    const rows = data.map((p) => ({
      "تاريخ العملية": p.trans_date,
      "وقت العملية": p.trans_time,
      "رقم الحساب": p.billing_account_number,
      "المبلغ": p.amount,
      "كود السداد": p.payment_code,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المدفوعات");
    XLSX.writeFile(wb, `payments-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!authorized) return null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // كود colors
  const codeColors: Record<string, string> = {
    FAWRYRTL: "bg-blue-50 text-blue-700",
    WSALERS: "bg-green-50 text-green-700",
    FMCGRTL: "bg-purple-50 text-purple-700",
    OTHERRTL: "bg-orange-50 text-orange-700",
    RTLACPT: "bg-teal-50 text-teal-700",
  };

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
            <p className="text-sm text-slate-500 mt-0.5">متابعة مدفوعات فوري واتصالات</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">إجمالي المدفوعات</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalCount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">معاملة</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">إجمالي المبالغ</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">جنيه</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">مدفوعات اليوم</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.todayCount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">معاملة</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500">مبالغ اليوم</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.todayAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">جنيه</p>
          </div>
        </div>

        {/* Import */}
        {canEdit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              رفع تقرير Oracle
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition text-sm ${
                importFile ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 hover:border-green-300 text-slate-400"
              }`}>
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                {importFile ? importFile.name : "اختر ملف Oracle .xlsx"}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }} />
              </label>
              <button onClick={importFromExcel} disabled={importing || !importFile}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                رفع
              </button>
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
              الأعمدة المطلوبة: <span className="font-mono">TRANS DATE, TRANS TIME, BILLING ACCOUNT NUMBER, Amount, CODE</span>
            </p>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="بحث برقم الحساب"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <button onClick={exportToExcel}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium text-sm transition">
              <Download className="w-4 h-4" /> تحميل
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={filterCode} onChange={(e) => { setFilterCode(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200 appearance-none">
                <option value="">كل الأكواد</option>
                {codes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200" />
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
                  <th className="p-3 text-right font-medium">التاريخ</th>
                  <th className="p-3 text-right font-medium">الوقت</th>
                  <th className="p-3 text-right font-medium">رقم الحساب</th>
                  <th className="p-3 text-right font-medium">المبلغ</th>
                  <th className="p-3 text-right font-medium">كود السداد</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 text-slate-500">{payment.trans_date}</td>
                    <td className="p-3 text-slate-400 font-mono text-xs">{payment.trans_time}</td>
                    <td className="p-3 font-mono font-medium text-slate-900">{payment.billing_account_number}</td>
                    <td className="p-3 font-bold text-green-600">{payment.amount?.toLocaleString()} جنيه</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        codeColors[payment.payment_code] || "bg-slate-100 text-slate-700"
                      }`}>
                        {payment.payment_code || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">لا توجد مدفوعات</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
              <span className="text-xs text-slate-400">{total.toLocaleString()} معاملة</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> السابق
                </button>
                <span className="px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-sm">{page}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
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