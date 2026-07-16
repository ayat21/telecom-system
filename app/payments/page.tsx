"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  CreditCard, Download, Search, Loader2, Check, X,
  ChevronLeft, ChevronRight, Cloud, UserCheck, UserX, Percent, Network, Calendar,
} from "lucide-react";

const PAGE_SIZE = 50;

// الأقسام المستبعدة لما "كل الأقسام" مختارة
const EXCLUDED_DEPARTMENTS = ["SPOC", "فوري", "العهدة", "هيثم"];

// رابط Google Sheet المنشور كـ CSV
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9OSpK1_ukTAgEP8emp5epTtdcCA1-a4iDSQ375wo6n_4sNaXVNwfwM-tfdrddrpU0P4TTElhCDHGG/pub?gid=1700747738&single=true&output=csv";

interface LineInfo {
  number: string;
  total_price: number;
  providerName: string;
  almanafizName: string;
  accountNo: string;
}

function StatCard({ label, value, suffix, icon: Icon, iconBg, iconColor, valueColor }: {
  label: string; value: string | number; suffix?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-sm">{label}</p>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </span>
      </div>
      <p className={`text-2xl font-bold mt-3 ${valueColor}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-slate-400 mr-1">{suffix}</span>}
      </p>
    </div>
  );
}

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
  const [filterCode, setFilterCode] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [providersList, setProvidersList] = useState<any[]>([]);

  // نطاق الأرقام المسموح بيها حسب فلتر القسم/الشبكة (null = بدون فلتر)
  const [scopedNumbers, setScopedNumbers] = useState<Set<string> | null>(null);

  // Stats
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalRequired: 0,
    totalCollected: 0,
    totalUnpaidAmount: 0,
    collectionRate: 0,
    paidLinesCount: 0,
    unpaidLinesCount: 0,
  });
  const [unpaidList, setUnpaidList] = useState<LineInfo[]>([]);
  const [paidList, setPaidList] = useState<(LineInfo & { amount: number })[]>([]);
  const [exportingUnpaid, setExportingUnpaid] = useState(false);
  const [exportingPaid, setExportingPaid] = useState(false);

  // Import (Google Sheet)
  const [sheetImportMonth, setSheetImportMonth] = useState("");
  const [sheetImporting, setSheetImporting] = useState(false);
  const [sheetProgress, setSheetProgress] = useState(0);
  const [sheetText, setSheetText] = useState("");
  const [sheetResult, setSheetResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

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
    supabase.from("providers").select("id, name").order("name")
      .then(({ data }) => setProvidersList(data || []));
  }, []);

  // ─── Load payments (الجدول) ────────────────────────────────
  async function loadPayments(numbersScope: Set<string> | null) {
    setLoading(true);

    const searchTerm = search.trim().toLowerCase();

    if (numbersScope !== null) {
      if (numbersScope.size === 0) {
        setPayments([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      let allMatching: any[] = [];
      let offset = 0;
      while (true) {
        let q = supabase.from("payments").select("*").range(offset, offset + 999);
        if (filterCode) q = q.eq("payment_code", filterCode);
        const { data, error } = await q;
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;

        data.forEach((p: any) => {
          if (!numbersScope.has(p.line_number)) return;
          if (searchTerm) {
            const matchesSearch =
              (p.line_number || "").toLowerCase().includes(searchTerm) ||
              (p.billing_account_number || "").toLowerCase().includes(searchTerm);
            if (!matchesSearch) return;
          }
          allMatching.push(p);
        });

        if (data.length < 1000) break;
        offset += 1000;
      }

      allMatching.sort((a, b) => b.id - a.id);
      setTotal(allMatching.length);
      setPayments(allMatching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      setLoading(false);
      return;
    }

    let query = supabase
      .from("payments")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search.trim())
      query = query.or(`line_number.ilike.%${search}%,billing_account_number.ilike.%${search}%`);
    if (filterCode)
      query = query.eq("payment_code", filterCode);

    const { data, count, error } = await query;
    if (error) console.error(error);
    setPayments(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  // ─── Parser ذكي لتواريخ الشيت (صيغ مختلطة) ────────────────
  const MONTH_NAMES: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  function parseSheetDate(value: any): string | null {
    if (!value) return null;
    let str = String(value).trim();
    if (!str) return null;

    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (month > 12 && day <= 12) {
        return `${m[1]}-${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
      }
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    m = str.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})/);
    if (m) {
      const mon = MONTH_NAMES[m[2].toLowerCase()];
      if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
    }

    m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = m[3];

      let day: number, month: number;
      if (a > 12 && b <= 12) {
        day = a; month = b;
      } else if (b > 12 && a <= 12) {
        day = b; month = a;
      } else {
        day = a; month = b;
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    return null;
  }

  // ─── جيبي أرقام الخطوط اللي جوا نطاق القسم/الشبكة (بتفاصيل الشبكة/المنفذ/الحساب) ───
  async function loadScopedLines(): Promise<LineInfo[]> {
    let lineQuery = supabase
      .from("lines")
      .select("number, total_price, account_id, departments(name), providers(name), almanafiz(name)")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .not("department_id", "is", null);

    if (filterDepartment) lineQuery = lineQuery.eq("department_id", Number(filterDepartment));
    if (filterProvider) lineQuery = lineQuery.eq("provider_id", Number(filterProvider));

    let rawLines: any[] = [];
    let lOffset = 0;
    while (true) {
      const { data } = await lineQuery.range(lOffset, lOffset + 999);
      if (!data || data.length === 0) break;

      const filtered = filterDepartment
        ? data
        : data.filter((l: any) => !EXCLUDED_DEPARTMENTS.includes(l.departments?.name || ""));

      rawLines.push(...filtered);
      if (data.length < 1000) break;
      lOffset += 1000;
    }

    // ─── هاتي account_no لكل account_id على خطوتين بسيطتين (بدون join) ───
    const accountIds = [...new Set(rawLines.map((l) => l.account_id).filter(Boolean))];
    const accountIdToNo = new Map<number, string>();
    for (let i = 0; i < accountIds.length; i += 1000) {
      const { data } = await supabase
        .from("accounts")
        .select("id, account_no")
        .in("id", accountIds.slice(i, i + 1000));
      (data || []).forEach((a: any) => accountIdToNo.set(a.id, a.account_no));
    }

    return rawLines.map((l: any) => ({
      number: l.number,
      total_price: l.total_price || 0,
      providerName: l.providers?.name || "—",
      almanafizName: l.almanafiz?.name || "—",
      accountNo: (l.account_id && accountIdToNo.get(l.account_id)) || "—",
    }));
  }

  // ─── Load stats + نطاق الأرقام ─────────────────────────────
  async function loadStatsAndScope() {
    setStatsLoading(true);

    const hasFilter = Boolean(filterDepartment || filterProvider);
    const departmentLines = await loadScopedLines();
    const lineNumberSet = new Set(departmentLines.map((l) => l.number));
    const totalRequired = departmentLines.reduce((s, l) => s + l.total_price, 0);

    const paidAmountByLine = new Map<string, number>();
    let pOffset = 0;
    while (true) {
      const { data } = await supabase.from("payments").select("line_number, amount")
        .range(pOffset, pOffset + 999);
      if (!data || data.length === 0) break;
      data.forEach((p: any) => {
        if (!lineNumberSet.has(p.line_number)) return;
        paidAmountByLine.set(p.line_number, (paidAmountByLine.get(p.line_number) || 0) + (p.amount || 0));
      });
      if (data.length < 1000) break;
      pOffset += 1000;
    }

    const totalCollected = [...paidAmountByLine.values()].reduce((s, a) => s + a, 0);
    const paidLinesCount = paidAmountByLine.size;
    const unpaid = departmentLines.filter((l) => !paidAmountByLine.has(l.number));
    const unpaidLinesCount = unpaid.length;
    const totalUnpaidAmount = Math.max(totalRequired - totalCollected, 0);
    const collectionRate = totalRequired > 0 ? (totalCollected / totalRequired) * 100 : 0;

    const paid = departmentLines
      .filter((l) => paidAmountByLine.has(l.number))
      .map((l) => ({ ...l, amount: paidAmountByLine.get(l.number) || 0 }));

    setUnpaidList(unpaid);
    setPaidList(paid);
    setStats({
      totalRequired,
      totalCollected,
      totalUnpaidAmount,
      collectionRate,
      paidLinesCount,
      unpaidLinesCount,
    });

    const { data: codesData } = await supabase
      .from("payments").select("payment_code").limit(10000);
    setCodes([...new Set((codesData || []).map((p) => p.payment_code).filter(Boolean))]);

    const numbersScope = hasFilter ? lineNumberSet : null;
    setScopedNumbers(numbersScope);
    setStatsLoading(false);
    return numbersScope;
  }

  useEffect(() => {
    (async () => {
      const scope = await loadStatsAndScope();
      loadPayments(scope);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setPage(1);
      const scope = await loadStatsAndScope();
      loadPayments(scope);
    })();
  }, [filterDepartment, filterProvider]);

  useEffect(() => {
    const t = setTimeout(() => loadPayments(scopedNumbers), 300);
    return () => clearTimeout(t);
  }, [search, filterCode, page]);

  // ─── Import من Google Sheet (upsert + مزامنة حذف) ─────────
  async function importFromGoogleSheet() {
    if (!sheetImportMonth) { alert("اختاري شهر السداد أولاً"); return; }

    setSheetImporting(true);
    setSheetProgress(0);
    setSheetText("جارٍ تحميل الشيت...");
    setSheetResult(null);

    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error("فشل تحميل الشيت — تأكدي إنه لسه Published");
      const csvText = await res.text();

      setSheetText("جارٍ تحليل البيانات...");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const rows = parsed.data as any[];

      const records: any[] = [];

      rows.forEach((r) => {
        const number = String(r["الرقم"] || "").trim();
        if (!number) return;

        const rawDate = String(r["تاريخ السداد"] || "").trim();
        const dateStr = parseSheetDate(rawDate);
        if (!dateStr) return;

        const sheetKey = `${number}|${rawDate}`;

        records.push({
          line_number: number,
          amount: Number(r["المبلغ"] || 0),
          payment_code: String(r["طريقه السداد"] || "").trim() || null,
          trans_date: dateStr,
          payment_month: sheetImportMonth,
          note: String(r["نوت"] || "").trim() || null,
          remaining: r["المتبقى"] !== undefined && r["المتبقى"] !== "" ? Number(r["المتبقى"]) : null,
          sheet_key: sheetKey,
        });
      });

      if (records.length === 0) throw new Error("مفيش سجلات صالحة في الشيت");

      // ─── رقم الحساب: من رقم الخط → account_id → account_no (خطوتين بسيطتين) ───
      setSheetText("جارٍ جلب أرقام الحسابات...");
      const allNumbers = [...new Set(records.map((r) => r.line_number))];
      const accountMap = new Map<string, string>();

      const lineToAccountId = new Map<string, number>();
      for (let i = 0; i < allNumbers.length; i += 1000) {
        const { data } = await supabase
          .from("lines")
          .select("number, account_id")
          .in("number", allNumbers.slice(i, i + 1000));
        (data || []).forEach((l: any) => {
          if (l.account_id) lineToAccountId.set(l.number, l.account_id);
        });
      }

      const accountIds = [...new Set([...lineToAccountId.values()])];
      const accountIdToNo = new Map<number, string>();
      for (let i = 0; i < accountIds.length; i += 1000) {
        const { data } = await supabase
          .from("accounts")
          .select("id, account_no")
          .in("id", accountIds.slice(i, i + 1000));
        (data || []).forEach((a: any) => accountIdToNo.set(a.id, a.account_no));
      }

      lineToAccountId.forEach((accId, number) => {
        const accNo = accountIdToNo.get(accId);
        if (accNo) accountMap.set(number, accNo);
      });

      const finalRecords = records.map((r) => ({
        ...r,
        billing_account_number: accountMap.get(r.line_number) || null,
      }));

      const uniqueMap = new Map<string, any>();
      finalRecords.forEach((r) => uniqueMap.set(r.sheet_key, r));
      const uniqueRecords = [...uniqueMap.values()];

      setSheetText(`جارٍ رفع ${uniqueRecords.length} سداد...`);
      let uploaded = 0;
      for (let i = 0; i < uniqueRecords.length; i += 500) {
        const batch = uniqueRecords.slice(i, i + 500);
        const { error } = await supabase
          .from("payments")
          .upsert(batch, { onConflict: "sheet_key" });
        if (error) throw new Error(error.message);
        uploaded = Math.min(i + 500, uniqueRecords.length);
        setSheetProgress(Math.round((uploaded / uniqueRecords.length) * 80));
        setSheetText(`تم رفع ${uploaded} من ${uniqueRecords.length}...`);
      }

      // ─── امسحي أي سداد كان من الشيت وبقى محذوف منه دلوقتي ───
      setSheetText("جارٍ مزامنة الحذف...");
      const currentKeys = new Set(uniqueRecords.map((r) => r.sheet_key));

      const existingKeys: string[] = [];
      let ekOffset = 0;
      while (true) {
        const { data } = await supabase
          .from("payments")
          .select("sheet_key")
          .not("sheet_key", "is", null)
          .range(ekOffset, ekOffset + 999);
        if (!data || data.length === 0) break;
        data.forEach((r: any) => { if (r.sheet_key) existingKeys.push(r.sheet_key); });
        if (data.length < 1000) break;
        ekOffset += 1000;
      }

      const keysToDelete = existingKeys.filter((k) => !currentKeys.has(k));

      if (keysToDelete.length > 0) {
        setSheetText(`جارٍ حذف ${keysToDelete.length} سداد اتشال من الشيت...`);
        for (let i = 0; i < keysToDelete.length; i += 500) {
          const batch = keysToDelete.slice(i, i + 500);
          const { error } = await supabase.from("payments").delete().in("sheet_key", batch);
          if (error) throw new Error(error.message);
        }
      }

      setSheetProgress(100);
      setSheetResult({
        status: "success",
        message: `تم رفع/تحديث ${uniqueRecords.length} سداد لشهر ${sheetImportMonth}${keysToDelete.length > 0 ? ` وحذف ${keysToDelete.length} سداد اتشال من الشيت` : ""}`,
      });

      const scope = await loadStatsAndScope();
      loadPayments(scope);
    } catch (err) {
      setSheetResult({
        status: "error",
        message: err instanceof Error ? err.message : "خطأ غير متوقع",
      });
    } finally {
      setSheetImporting(false);
    }
  }

  // ─── تصدير الغير مسددين (مع الشبكة والمنفذ ورقم الحساب) ────
  function exportUnpaid() {
    if (unpaidList.length === 0) { alert("لا توجد أرقام غير مسددة حسب الفلتر الحالي"); return; }
    setExportingUnpaid(true);
    try {
      const rows = unpaidList.map((l) => ({
        "رقم الخط": l.number,
        "الشبكة": l.providerName,
        "رقم الحساب": l.accountNo,
        "المنفذ": l.almanafizName,
        "المبلغ المطلوب": l.total_price,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "غير مسدد");
      XLSX.writeFile(wb, `unpaid.xlsx`);
    } finally {
      setExportingUnpaid(false);
    }
  }

  // ─── تصدير المسددين (مع الشبكة والمنفذ ورقم الحساب) ────────
  function exportPaid() {
    if (paidList.length === 0) { alert("لا توجد أرقام مسددة حسب الفلتر الحالي"); return; }
    setExportingPaid(true);
    try {
      const rows = paidList.map((l) => ({
        "رقم الخط": l.number,
        "الشبكة": l.providerName,
        "رقم الحساب": l.accountNo,
        "المنفذ": l.almanafizName,
        "المبلغ المحصل": l.amount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "مسدد");
      XLSX.writeFile(wb, `paid.xlsx`);
    } finally {
      setExportingPaid(false);
    }
  }

  // ─── Export الجدول ────────────────────────────────────────
  async function exportToExcel() {
    if (scopedNumbers !== null) {
      let allMatching: any[] = [];
      let offset = 0;
      while (true) {
        let q = supabase.from("payments").select("*").range(offset, offset + 999);
        if (filterCode) q = q.eq("payment_code", filterCode);
        const { data } = await q;
        if (!data || data.length === 0) break;
        data.forEach((p: any) => { if (scopedNumbers.has(p.line_number)) allMatching.push(p); });
        if (data.length < 1000) break;
        offset += 1000;
      }
      writeExcelRows(allMatching);
      return;
    }

    let query = supabase.from("payments").select("*").order("id", { ascending: false });
    if (filterCode) query = query.eq("payment_code", filterCode);
    const { data } = await query.limit(100000);
    writeExcelRows(data || []);
  }

  function writeExcelRows(data: any[]) {
    const rows = data.map((p) => ({
      "رقم الخط": p.line_number,
      "رقم الحساب": p.billing_account_number,
      "المبلغ": p.amount,
      "طريقة السداد": p.payment_code,
      "شهر السداد": p.payment_month,
      "تاريخ العملية": p.trans_date,
      "النوت": p.note,
      "المتبقي": p.remaining,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المدفوعات");
    XLSX.writeFile(wb, `payments-all.xlsx`);
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

        {/* Department + Provider filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">فلتر القسم</label>
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200">
                <option value="">كل الأقسام </option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Network className="w-3.5 h-3.5" /> فلتر الشبكة
              </label>
              <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-200">
                <option value="">كل الشبكات</option>
                {providersList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-10 text-slate-400 mb-6">
            <Loader2 className="w-5 h-5 animate-spin" /> جارٍ حساب الإحصائيات...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <StatCard label="إجمالي المطلوب" value={stats.totalRequired.toLocaleString()} suffix="جنيه"
                icon={CreditCard} iconBg="bg-purple-50" iconColor="text-purple-600" valueColor="text-purple-600" />
              <StatCard label="إجمالي المحصل" value={stats.totalCollected.toLocaleString()} suffix="جنيه"
                icon={Check} iconBg="bg-green-50" iconColor="text-green-600" valueColor="text-green-600" />
              <StatCard label="إجمالي الغير مسدد" value={stats.totalUnpaidAmount.toLocaleString()} suffix="جنيه"
                icon={X} iconBg="bg-red-50" iconColor="text-red-500" valueColor="text-red-500" />
              <StatCard label="نسبة التحصيل" value={`${stats.collectionRate.toFixed(1)}%`}
                icon={Percent} iconBg="bg-blue-50" iconColor="text-blue-600" valueColor="text-blue-600" />
              <StatCard label="عدد المسددين" value={stats.paidLinesCount} suffix="خط"
                icon={UserCheck} iconBg="bg-teal-50" iconColor="text-teal-600" valueColor="text-teal-600" />
              <StatCard label="عدد الغير مسددين" value={stats.unpaidLinesCount} suffix="خط"
                icon={UserX} iconBg="bg-orange-50" iconColor="text-orange-600" valueColor="text-orange-600" />
            </div>

            <div className="flex flex-wrap justify-end gap-3 mb-6">
              <button onClick={exportPaid} disabled={exportingPaid || stats.paidLinesCount === 0}
                className="flex items-center gap-2 bg-green-50 hover:bg-green-100 disabled:opacity-50 text-green-700 px-5 py-2.5 rounded-xl font-medium text-sm transition border border-green-100">
                {exportingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                تحميل قائمة المسددين ({stats.paidLinesCount})
              </button>
              <button onClick={exportUnpaid} disabled={exportingUnpaid || stats.unpaidLinesCount === 0}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 px-5 py-2.5 rounded-xl font-medium text-sm transition border border-red-100">
                {exportingUnpaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                تحميل قائمة الغير مسددين ({stats.unpaidLinesCount})
              </button>
            </div>
          </>
        )}

        {/* Import من Google Sheet */}
        {canEdit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              استيراد من Google Sheet
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="month" value={sheetImportMonth}
                  onChange={(e) => setSheetImportMonth(e.target.value)}
                  className="border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <button onClick={importFromGoogleSheet} disabled={sheetImporting || !sheetImportMonth}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
                {sheetImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                استيراد / تحديث السدادات من الشيت
              </button>
              <p className="text-xs text-slate-400">
                هيحدث الموجود ويضيف الجديد ويحذف أي سداد اتشال من الشيت
              </p>
            </div>

            {sheetImporting && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{sheetText}</span>
                  <span>{sheetProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${sheetProgress}%` }} />
                </div>
              </div>
            )}

            {sheetResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
                sheetResult.status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {sheetResult.status === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {sheetResult.message}
              </div>
            )}
          </div>
        )}

        {/* Filters (جدول السدادات) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="بحث برقم الخط أو رقم الحساب"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
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
                  <th className="p-3 text-right font-medium">المتبقي</th>
                  <th className="p-3 text-right font-medium">النوت</th>
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
                    <td className="p-3 text-xs">
                      {payment.remaining != null ? (
                        <span className={payment.remaining < 0 ? "text-red-500 font-medium" : "text-slate-600"}>
                          {payment.remaining.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-xs text-slate-400 max-w-[160px] truncate" title={payment.note || ""}>
                      {payment.note || "—"}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">لا توجد سدادات</td>
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