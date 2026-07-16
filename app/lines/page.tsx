"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import {
  PhoneCall, Wifi, Signal, Radio, PlusCircle, Download,
  Search, Filter, Calendar, Network, Eye, Pencil, Trash2,
  ChevronRight, ChevronLeft, Loader2, Archive,
} from "lucide-react";
import SortableTable from "@/app/components/SortableTable";

const LINE_EXPORT_SELECT = `
  number, customer_date_real, total_price, serial_number, has_sim, note, report_note,
  calls_package_price, internet_package_price, line_extension_price,
  clients(name, national_id, address),
  providers(name),
  accounts(account_no, account_name),
  almanafiz(name),
  heiaat(name),
  agents(name),
  departments(name),
  groups(name),
  line_statuses(name),
  calls_packages(package_name),
  internet_packages(package_name),
  line_extensions(extension_name)
`;

// المنفذ ممكن يكون منافذ عادية أو هيئة أو مجرد قسم (زي Spoc) من غير منفذ محدد
function getMenfazName(line: any): string | null {
  return line.almanafiz?.name || line.heiaat?.name || line.departments?.name || null;
}

function lineToExcelRow(line: any) {
  return {
    رقم_الخط: line.number,
    العميل: line.clients?.name,
    الرقم_القومي: line.clients?.national_id,
    العنوان: line.clients?.address,
    تاريخ_العميل: line.customer_date_real,
    الشبكة: line.providers?.name,
    الأكونت: line.accounts?.account_no,
    اسم_الأكونت: line.accounts?.account_name,
    المنفذ: getMenfazName(line),
    المندوب: line.agents?.name,
    القسم: line.departments?.name,
    الجروب: line.groups?.name,
    حالة_الخط: line.line_statuses?.name,
    باقة_المكالمات: line.calls_packages?.package_name,
    سعر_المكالمات: line.calls_package_price,
    باقة_الإنترنت: line.internet_packages?.package_name,
    سعر_الإنترنت: line.internet_package_price,
    الإضافة: line.line_extensions?.extension_name,
    سعر_الإضافة: line.line_extension_price,
    إجمالي_السعر: line.total_price,
    سيريال_نمبر: line.serial_number,
    على_شريحة: line.has_sim ? "نعم" : "لا",
    ملاحظات: line.note,
    ملاحظات_التقرير: line.report_note,
  };
}

export default function LinesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [custodyProgressText, setCustodyProgressText] = useState("");
  const [custodyProgressPercent, setCustodyProgressPercent] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterProvider, setFilterProvider] = useState("");
  const [filterAlmanafiz, setFilterAlmanafiz] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [role, setRole] = useState("");

  const PAGE_SIZE = 50;

  const [stats, setStats] = useState({
    totalLines: 0,
    vodafone: 0,
    orange: 0,
    etisalat: 0,
  });

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";

  useEffect(() => {
    const r = localStorage.getItem("role");
    setRole(r || "");
    if (!r) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Load lookups ─────────────────────────────────────────
  useEffect(() => {
    async function loadLookups() {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from("providers").select("id, name"),
        supabase.from("almanafiz").select("id, name"),
      ]);
      setProviders(p || []);
      setAlmanafizList(a || []);
    }
    loadLookups();
  }, []);

  // ─── Load Lines ───────────────────────────────────────────
 async function loadLines() {
  setLoading(true);

  let query = supabase
    .from("lines")
    .select(`
      id, client_id, number, customer_date_real, report_note, total_price, has_sim,
      clients(name),
      providers(name),
      almanafiz(name),
      heiaat(name),
      departments(name),
      calls_packages(package_name),
      line_statuses(name)
    `)
    .not("is_deleted", "eq", true)
    .order("id", { ascending: false });

  if (search.trim()) {
    // دوري عن عملاء بالاسم الأول
    const { data: matchedClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", `%${search}%`);

    const clientIds = (matchedClients || []).map((c) => c.id);

    if (clientIds.length > 0) {
      query = query.or(`number.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
    } else {
      query = query.ilike("number", `%${search}%`);
    }
  }

  if (filterProvider)
    query = query.eq("provider_id", Number(filterProvider));
  if (filterAlmanafiz)
    query = query.eq("almanafiz_id", Number(filterAlmanafiz));
  if (fromDate) query = query.gte("customer_date_real", fromDate);
  if (toDate) query = query.lte("customer_date_real", toDate);

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, error } = await query;
  if (!error) setLines(data || []);
  setLoading(false);
}
  // ─── Load Stats ───────────────────────────────────────────
  async function loadStats() {
    const { count } = await supabase
      .from("lines")
      .select("*", { count: "exact", head: true })
      .or("is_deleted.is.null,is_deleted.eq.false");

    // جيب IDs الشبكات من providers
    const { data: providersList } = await supabase.from("providers").select("id, name");

    const vodafoneId = providersList?.find((p) => p.name.toLowerCase().includes("vodafone"))?.id;
    const orangeId = providersList?.find((p) => p.name.toLowerCase().includes("orange"))?.id;
    const etisalatId = providersList?.find((p) => p.name.toLowerCase().includes("etisalat"))?.id;

    const [{ count: vodafone }, { count: orange }, { count: etisalat }] = await Promise.all([
      vodafoneId
        ? supabase.from("lines").select("*", { count: "exact", head: true }).eq("provider_id", vodafoneId).or("is_deleted.is.null,is_deleted.eq.false")
        : Promise.resolve({ count: 0 }),
      orangeId
        ? supabase.from("lines").select("*", { count: "exact", head: true }).eq("provider_id", orangeId).or("is_deleted.is.null,is_deleted.eq.false")
        : Promise.resolve({ count: 0 }),
      etisalatId
        ? supabase.from("lines").select("*", { count: "exact", head: true }).eq("provider_id", etisalatId).or("is_deleted.is.null,is_deleted.eq.false")
        : Promise.resolve({ count: 0 }),
    ]);

    setStats({
      totalLines: count || 0,
      vodafone: vodafone || 0,
      orange: orange || 0,
      etisalat: etisalat || 0,
    });
  }

  // ─── Delete Line ──────────────────────────────────────────
  async function deleteLine(id: number) {
    if (!confirm("هل أنت متأكد من حذف الخط؟")) return;

    const row = lines.find((x: any) => x.id === id);
    if (!row) return;

    await supabase.from("audit_logs").insert({
      user_name: localStorage.getItem("full_name") || "Unknown",
      action_type: "DELETE",
      table_name: "lines",
      record_id: id,
      old_data: row,
    });

    await supabase.from("history").insert({
      number: row.number,
      customer_name: row.clients?.name || null,
      national_id: null,
      address: null,
      almanafiz: row.almanafiz?.name || null,
      action_type: "cancelled",
      action_date: new Date().toISOString(),
    });

    const { error } = await supabase
      .from("lines")
      .update({
        client_id: null,
        almanafiz_id: null,
        department_id: null,
        group_id: null,
        account_id: null,
        is_deleted: true,
      })
      .eq("id", Number(id));

    if (error) {
      console.error("ERROR =", error);
      alert("حصل خطأ أثناء الحذف");
      return;
    }

    await loadLines();
  }

  // ─── Export Excel ─────────────────────────────────────────
  async function exportToExcel() {
    setExportLoading(true);
    setProgressPercent(0);
    setProgressText("");

    try {
     let countQuery = supabase
  .from("lines")
  .select("*", { count: "exact", head: true })
  .not("is_deleted", "eq", true);

if (search.trim()) {
  const { data: matchedClients } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", `%${search}%`);
  const clientIds = (matchedClients || []).map((c) => c.id);
  if (clientIds.length > 0) {
    countQuery = countQuery.or(`number.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
  } else {
    countQuery = countQuery.ilike("number", `%${search}%`);
  }
}
      if (filterProvider) countQuery = countQuery.eq("provider_id", Number(filterProvider));
      if (filterAlmanafiz) countQuery = countQuery.eq("almanafiz_id", Number(filterAlmanafiz));
      if (fromDate) countQuery = countQuery.gte("customer_date_real", fromDate);
      if (toDate) countQuery = countQuery.lte("customer_date_real", toDate);

      const { count } = await countQuery;
      const total = count || 0;
      const batchSize = 1000;
      const totalBatches = Math.ceil(total / batchSize);

      setProgressText(`جارٍ تحميل ${total.toLocaleString()} سجل...`);

      let allData: any[] = [];
      const concurrency = 10;

      for (let i = 0; i < totalBatches; i += concurrency) {
        const batchPromises = [];

        for (let j = i; j < Math.min(i + concurrency, totalBatches); j++) {
  let q = supabase
    .from("lines")
    .select(LINE_EXPORT_SELECT)
    .not("is_deleted", "eq", true)
    .order("id", { ascending: false })
    .range(j * batchSize, (j + 1) * batchSize - 1);

  if (search.trim()) {
    const { data: matchedClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", `%${search}%`);
    const clientIds = (matchedClients || []).map((c) => c.id);
    if (clientIds.length > 0) {
      q = q.or(`number.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
    } else {
      q = q.ilike("number", `%${search}%`);
    }
  }
          if (filterProvider) q = q.eq("provider_id", Number(filterProvider));
          if (filterAlmanafiz) q = q.eq("almanafiz_id", Number(filterAlmanafiz));
          if (fromDate) q = q.gte("customer_date_real", fromDate);
          if (toDate) q = q.lte("customer_date_real", toDate);

          batchPromises.push(q);
        }

        const results = await Promise.all(batchPromises);

        for (const { data, error } of results) {
          if (error) throw new Error(error.message);
          allData = [...allData, ...(data || []).map(lineToExcelRow)];
        }

        setProgressPercent(Math.round((allData.length / total) * 100));
        setProgressText(`تم تحميل ${allData.length.toLocaleString()} من ${total.toLocaleString()} سجل...`);
      }

      const worksheet = XLSX.utils.json_to_sheet(allData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lines");
      XLSX.writeFile(workbook, `telecom-lines-${allData.length}.xlsx`);

    } catch (err) {
      console.error(err);
      alert(`خطأ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
      setProgressPercent(0);
      setProgressText("");
    }
  }

  // ─── Export العهدة الحالية (الخطوط الغير مباعة/الملغاة) ────
  async function exportUnsoldToExcel() {
    setCustodyLoading(true);
    setCustodyProgressPercent(0);
    setCustodyProgressText("");

    try {
      let countQuery = supabase
        .from("lines")
        .select("*", { count: "exact", head: true })
        .or("is_deleted.is.null,is_deleted.eq.false")
        .eq("is_deactive", true);

      if (search.trim()) {
        const { data: matchedClients } = await supabase
          .from("clients")
          .select("id")
          .ilike("name", `%${search}%`);
        const clientIds = (matchedClients || []).map((c) => c.id);
        if (clientIds.length > 0) {
          countQuery = countQuery.or(`number.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
        } else {
          countQuery = countQuery.ilike("number", `%${search}%`);
        }
      }
      if (filterProvider) countQuery = countQuery.eq("provider_id", Number(filterProvider));
      if (filterAlmanafiz) countQuery = countQuery.eq("almanafiz_id", Number(filterAlmanafiz));

      const { count } = await countQuery;
      const total = count || 0;
      const batchSize = 1000;
      const totalBatches = Math.ceil(total / batchSize);

      setCustodyProgressText(`جارٍ تحميل ${total.toLocaleString()} سجل...`);

      let allData: any[] = [];
      const concurrency = 10;

      for (let i = 0; i < totalBatches; i += concurrency) {
        const batchPromises = [];

        for (let j = i; j < Math.min(i + concurrency, totalBatches); j++) {
          let q = supabase
            .from("lines")
            .select(LINE_EXPORT_SELECT)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .eq("is_deactive", true)
            .order("id", { ascending: false })
            .range(j * batchSize, (j + 1) * batchSize - 1);

          if (search.trim()) {
            const { data: matchedClients } = await supabase
              .from("clients")
              .select("id")
              .ilike("name", `%${search}%`);
            const clientIds = (matchedClients || []).map((c) => c.id);
            if (clientIds.length > 0) {
              q = q.or(`number.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
            } else {
              q = q.ilike("number", `%${search}%`);
            }
          }
          if (filterProvider) q = q.eq("provider_id", Number(filterProvider));
          if (filterAlmanafiz) q = q.eq("almanafiz_id", Number(filterAlmanafiz));

          batchPromises.push(q);
        }

        const results = await Promise.all(batchPromises);

        for (const { data, error } of results) {
          if (error) throw new Error(error.message);
          allData = [...allData, ...(data || []).map(lineToExcelRow)];
        }

        setCustodyProgressPercent(total > 0 ? Math.round((allData.length / total) * 100) : 100);
        setCustodyProgressText(`تم تحميل ${allData.length.toLocaleString()} من ${total.toLocaleString()} سجل...`);
      }

      const worksheet = XLSX.utils.json_to_sheet(allData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "العهدة الحالية");
      XLSX.writeFile(workbook, `العهدة-الحالية-${allData.length}.xlsx`);

    } catch (err) {
      console.error(err);
      alert(`خطأ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCustodyLoading(false);
      setCustodyProgressPercent(0);
      setCustodyProgressText("");
    }
  }

  useEffect(() => { loadLines(); loadStats(); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => { loadLines(); }, 300);
    return () => clearTimeout(timeout);
  }, [search, filterProvider, filterAlmanafiz, fromDate, toDate, page]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <PhoneCall className="w-6 h-6 text-blue-600" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة الخطوط</h1>
          <p className="text-sm text-slate-500 mt-0.5">عرض وإدارة كل الخطوط المسجلة في النظام</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">إجمالي الخطوط</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalLines.toLocaleString()}</p>
          </div>
          <span className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-blue-600" />
          </span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">اتصالات</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.etisalat.toLocaleString()}</p>
          </div>
          <span className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center shrink-0">
            <Signal className="w-5 h-5 text-green-600" />
          </span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">أورنج</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{stats.orange.toLocaleString()}</p>
          </div>
          <span className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5 text-orange-600" />
          </span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">فودافون</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{stats.vodafone.toLocaleString()}</p>
          </div>
          <span className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-red-600" />
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/lines/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm">
          <PlusCircle className="w-4 h-4" /> إضافة خط جديد
        </Link>

        <div className="flex flex-col gap-1.5">
          <button onClick={exportToExcel} disabled={exportLoading}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition text-slate-700 px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm">
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تحميل Excel
          </button>
          {exportLoading && progressText && (
            <div className="w-64">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button onClick={exportUnsoldToExcel} disabled={custodyLoading}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition text-slate-700 px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm">
            {custodyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            العهدة الحالية
          </button>
          {custodyLoading && custodyProgressText && (
            <div className="w-64">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{custodyProgressText}</span>
                <span>{custodyProgressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${custodyProgressPercent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الخط أو اسم العميل"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
          </div>
          <button onClick={loadLines}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-6 rounded-xl shadow-sm font-medium text-sm">
            <Search className="w-4 h-4" /> بحث
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          {/* فلتر الشبكة */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none">
              <option value="">كل الشبكات</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* فلتر المنفذ */}
          <div className="relative">
            <Network className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select value={filterAlmanafiz} onChange={(e) => setFilterAlmanafiz(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none">
              <option value="">كل المنافذ</option>
              {almanafizList.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 bg-white rounded-2xl shadow-sm border border-slate-100 py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
        </div>
        ) : (
        <div>
          <SortableTable
            columns={[
              { key: "number", label: "الرقم", className: "font-medium text-slate-900" },
              { label: "العميل", render: (r) => r.clients?.name || "—" },
              { key: "customer_date_real", label: "التاريخ" },
              { label: "المنفذ", render: (r) => getMenfazName(r) || "—" },
              { label: "الشبكة", render: (r) => <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{r.providers?.name || "—"}</span> },
              { label: "حالة الخط", render: (r) => r.line_statuses?.name ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{r.line_statuses.name}</span> : "—" },
              { label: "باقة المكالمات", render: (r) => r.calls_packages?.package_name || "—" },
              { key: "total_price", label: "إجمالي السعر", className: "font-semibold text-slate-900" },
            ]}
            data={lines}
            idKey="id"
            actions={(line) => (
              <>
                <button onClick={() => router.push(`/lines/view/${line.id}`)} title="عرض"
                  className="bg-sky-50 hover:bg-sky-100 text-sky-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                  <Eye className="w-4 h-4" />
                </button>
                {(isSuperAdmin || isAdmin) && (
                  <button onClick={() => router.push(`/lines/${line.id}`)} title="تعديل"
                    className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {isSuperAdmin && (
                  <button onClick={() => deleteLine(line.id)} title="حذف"
                    className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          />

          <div className="flex justify-start items-center gap-2 p-4 border-t border-slate-100" dir="ltr">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
              <ChevronLeft className="w-4 h-4" /> السابق
            </button>
            <span className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">{page}</span>
            <button onClick={() => setPage(page + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium">
              التالى <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}