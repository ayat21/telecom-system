"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Download, ShoppingBag, ArrowRightLeft, EyeOff,
  PieChart as PieChartIcon, Users, ClipboardList,
  Filter, Calendar, ChevronLeft, Star, Loader2, ImageDown,
} from "lucide-react";
import { useRouter } from "next/navigation";

const MIGRATION_DEPT_ID = 10;

interface DailyRow { date: string; sales: number; migration: number; unsold: number; total: number; }
interface AgentRow { name: string; id: number; sales: number; }
interface ProviderRow { name: string; id: number; value: number; }

const COLORS = ["#22c55e", "#f97316", "#ef4444", "#3b82f6", "#a855f7"];
const PROVIDER_COLORS: Record<string, string> = {
  "اتصالات": "#22c55e", "اورنج": "#f97316", "فودافون": "#ef4444",
};
function getProviderColor(name: string, index: number) {
  return PROVIDER_COLORS[name] ?? COLORS[index % COLORS.length];
}

// فلتر موحّد: يستبعد المحذوف والملغى (Deactive)
function applyActiveFilter(q: any) {
  return q
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("is_deactive.is.null,is_deactive.eq.false");
}

function StatCard({ label, value, suffix, subLabel, subValue, icon: Icon, iconBg, iconColor, valueColor }: {
  label: string; value: string | number; suffix?: string;
  subLabel?: string; subValue?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-sm">{label}</p>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </span>
      </div>
      <div className="mt-3">
        <h2 className={`text-3xl font-bold ${valueColor}`}>
          {value}
          {suffix && <span className="text-base font-normal text-slate-400 mr-1">{suffix}</span>}
        </h2>
        {subLabel && (
          <p className="text-xs text-slate-400 mt-1">
            {subValue}<span className="mr-1">{subLabel}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, className = "", children }: {
  title: string; icon?: React.ElementType; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {Icon && <Icon className="w-5 h-5 text-slate-300" />}
      </div>
      {children}
    </div>
  );
}

export default function SalesPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [authorized, setAuthorized] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  const [stats, setStats] = useState({
    totalLines: 0,      // إجمالي المبيعات (كل خط اتباع فعلياً — مش الخطوط الكل)
    totalInventory: 0,  // إجمالي المخزون الفعّال (بدون محذوف/ملغى)
    sales: 0, migration: 0, unsold: 0,
  });

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Load lookups ─────────────────────────────────────────
  useEffect(() => {
    async function loadLookups() {
      const [{ data: p }, { data: ag }] = await Promise.all([
        supabase.from("providers").select("id, name"),
        supabase.from("agents").select("id, name").eq("is_active", true),
      ]);
      setProviders(p || []);
      setAgents(ag || []);
    }
    loadLookups();
  }, []);

  // ─── Load data ────────────────────────────────────────────
  async function loadData() {
    setLoading(true);

    // خطوط الفترة المفلترة (لحساب مبيعات/مايجريشن والجداول التفصيلية)
    let query = applyActiveFilter(
      supabase
        .from("lines")
        .select(`
          id, customer_date_real, department_id, agent_id, provider_id,
          providers(id, name),
          agents(id, name),
          departments(id, name)
        `)
    );

    if (fromDate) query = query.gte("customer_date_real", fromDate);
    if (toDate) query = query.lte("customer_date_real", toDate);
    if (filterProvider) query = query.eq("provider_id", Number(filterProvider));
    if (filterAgent) query = query.eq("agent_id", Number(filterAgent));

    const { data, error } = await query;

    if (error) { console.error(error); setLoading(false); return; }

    const result = data || [];
    setLines(result);

const migration = result.filter((x: any) => x.department_id === MIGRATION_DEPT_ID).length;
   const sales = result.filter((x: any) =>
  x.department_id && x.department_id !== MIGRATION_DEPT_ID
).length;

    // إجمالي كل المبيعات الفعلية (كل خط عنده department_id ومش مايجريشن) — من غير فلتر تاريخ
    let totalSalesQuery = applyActiveFilter(
      supabase.from("lines").select("*", { count: "exact", head: true })
    ).not("department_id", "is", null).neq("department_id", MIGRATION_DEPT_ID);
    if (filterProvider) totalSalesQuery = totalSalesQuery.eq("provider_id", Number(filterProvider));
    if (filterAgent) totalSalesQuery = totalSalesQuery.eq("agent_id", Number(filterAgent));
    const { count: totalSalesCount } = await totalSalesQuery;

    // إجمالي كل المخزون الفعّال (بدون محذوف/ملغى) — من غير فلتر تاريخ
    let totalInventoryQuery = applyActiveFilter(
      supabase.from("lines").select("*", { count: "exact", head: true })
    );
    if (filterProvider) totalInventoryQuery = totalInventoryQuery.eq("provider_id", Number(filterProvider));
    if (filterAgent) totalInventoryQuery = totalInventoryQuery.eq("agent_id", Number(filterAgent));
    const { count: totalInventoryCount } = await totalInventoryQuery;

    // الغير مباع الحالي — من غير فلتر تاريخ
    let unsoldQuery = applyActiveFilter(
      supabase.from("lines").select("*", { count: "exact", head: true })
    ).is("department_id", null);
    if (filterProvider) unsoldQuery = unsoldQuery.eq("provider_id", Number(filterProvider));
    if (filterAgent) unsoldQuery = unsoldQuery.eq("agent_id", Number(filterAgent));
    const { count: unsoldCount } = await unsoldQuery;

    setStats({
      totalLines: totalSalesCount || 0,        // كارت "إجمالي المبيعات" الجديد
      totalInventory: totalInventoryCount || 0,
      sales,        // بيتفلتر بالتاريخ (أحداث بيع فعلية في الفترة المختارة)
      migration,    // بيتفلتر بالتاريخ
      unsold: unsoldCount || 0,  // من غير فلتر تاريخ (حالة حالية للمخزون)
    });
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // ─── Derived data ─────────────────────────────────────────
  const agentData: AgentRow[] = useMemo(() => {
    const map = new Map<number, AgentRow>();
    lines.forEach((x) => {
      if (!x.agent_id) return;
      const name = x.agents?.name || `agent_${x.agent_id}`;
      if (!map.has(x.agent_id)) map.set(x.agent_id, { id: x.agent_id, name, sales: 0 });
      map.get(x.agent_id)!.sales++;
    });
    return [...map.values()].sort((a, b) => b.sales - a.sales);
  }, [lines]);

  const topAgents = useMemo(() => agentData.slice(0, 10), [agentData]);

  const providerData: ProviderRow[] = useMemo(() => {
    const map = new Map<number, ProviderRow>();
    lines.forEach((x) => {
      if (!x.provider_id) return;
      const name = x.providers?.name || `provider_${x.provider_id}`;
      if (!map.has(x.provider_id)) map.set(x.provider_id, { id: x.provider_id, name, value: 0 });
      map.get(x.provider_id)!.value++;
    });
    return [...map.values()];
  }, [lines]);

  const dailySales: DailyRow[] = useMemo(() => {
    const map = new Map<string, DailyRow>();
    lines.forEach((x) => {
      const date = x.customer_date_real || "غير محدد";
      if (!map.has(date)) map.set(date, { date, sales: 0, migration: 0, unsold: 0, total: 0 });
      const row = map.get(date)!;
      row.total++;
      if (x.department_id === MIGRATION_DEPT_ID) row.migration++;
      else if (!x.department_id) row.unsold++;
      else row.sales++;
    });
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [lines]);

  // نسبة المبيعات بالنسبة لإجمالي (المبيعات + الغير مباع الحالي) — مش كل المخزون
  const salesVsUnsoldTotal = stats.sales + stats.unsold;
  const salesPercent = salesVsUnsoldTotal > 0 ? ((stats.sales / salesVsUnsoldTotal) * 100).toFixed(2) : "0.00";
  const migrationPercent = stats.totalInventory > 0 ? ((stats.migration / stats.totalInventory) * 100).toFixed(2) : "0.00";
  const unsoldPercent = salesVsUnsoldTotal > 0 ? ((stats.unsold / salesVsUnsoldTotal) * 100).toFixed(2) : "0.00";
  const totalForSummary = stats.sales + stats.migration;

  // ─── Export كصورة ─────────────────────────────────────────
  async function exportReportImage() {
    if (!reportRef.current) return;
    setExportingImage(true);
    try {
const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(reportRef.current, {
  backgroundColor: "#f8fafc",
  scale: 2,
  useCORS: true,
  ignoreElements: (element) => element.tagName === "IFRAME",
});
      const link = document.createElement("a");
      link.download = `تقرير_المبيعات_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      alert("حصل خطأ أثناء تصدير الصورة");
    } finally {
      setExportingImage(false);
    }
  }

  if (!authorized) return null;

  return (
    <div ref={reportRef} dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">تقرير المبيعات</h1>
            <ClipboardList className="w-7 h-7 text-blue-500" />
          </div>
          <p className="text-slate-500 mt-1">تحليل شامل لأداء المبيعات في الفترة المحددة</p>
        </div>
        <button onClick={exportReportImage} disabled={exportingImage}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition self-start">
          {exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
          <span className="font-medium">{exportingImage ? "جارٍ التصدير..." : "تصدير كصورة"}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">من تاريخ</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">إلى تاريخ</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">الشبكة</label>
            <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">كل الشبكات</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">المندوب</label>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">كل المندوبين</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button onClick={loadData} disabled={loading}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl p-2.5 font-medium text-sm transition">
            <Filter className="w-4 h-4" />
            {loading ? "جارٍ التحميل..." : "تصفية"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="إجمالي المبيعات (الفترة)" value={stats.sales} suffix="خط"
          subLabel="% من (مبيعات + غير مباع)" subValue={salesPercent}
          icon={ShoppingBag} iconBg="bg-green-50" iconColor="text-green-600" valueColor="text-green-600" />
        <StatCard label="إجمالي مايجريشن" value={stats.migration} suffix="خط"
          subLabel="% من الإجمالي" subValue={migrationPercent}
          icon={ArrowRightLeft} iconBg="bg-orange-50" iconColor="text-orange-600" valueColor="text-orange-600" />
        <StatCard label="الغير مباع" value={stats.unsold} suffix="خط"
          subLabel="% من (مبيعات + غير مباع)" subValue={unsoldPercent}
          icon={EyeOff} iconBg="bg-red-50" iconColor="text-red-600" valueColor="text-red-600" />
        <StatCard label="نسبة المبيعات" value={`${salesPercent}%`}
          subLabel="من إجمالي الغير مباع الحالي"
          icon={PieChartIcon} iconBg="bg-purple-50" iconColor="text-purple-600" valueColor="text-purple-600" />
        <StatCard label="نسبة مايجريشن" value={`${migrationPercent}%`}
          subLabel="من إجمالي الخطوط"
          icon={Users} iconBg="bg-rose-50" iconColor="text-rose-600" valueColor="text-rose-600" />
        <StatCard label="إجمالي المبيعات (الكل)" value={stats.totalLines} suffix="خط"
          icon={ClipboardList} iconBg="bg-blue-50" iconColor="text-blue-600" valueColor="text-slate-900" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Bar chart */}
        <SectionCard title="مبيعات حسب المندوب" icon={ClipboardList} className="lg:col-span-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl" }} />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Top agents */}
        <SectionCard title="أفضل 10 مندوبين" icon={Star} className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">#</th>
                  <th className="text-right py-2 font-medium">المندوب</th>
                  <th className="text-right py-2 font-medium">المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-400">{index + 1}</td>
                    <td className="py-2 text-slate-700">{item.name}</td>
                    <td className="py-2 text-slate-900 font-semibold">{item.sales}</td>
                  </tr>
                ))}
                {topAgents.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-400">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Provider pie */}
        <SectionCard title="توزيع المبيعات حسب الشبكة" icon={PieChartIcon} className="lg:col-span-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={providerData} dataKey="value" nameKey="name"
                  innerRadius={55} outerRadius={90} paddingAngle={2}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}>
                  {providerData.map((entry, index) => (
                    <Cell key={entry.name} fill={getProviderColor(entry.name, index)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs flex-wrap">
            {providerData.map((p, i) => {
              const pct = lines.length > 0 ? ((p.value / lines.length) * 100).toFixed(1) : "0.0";
              return (
                <span key={p.name} className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: getProviderColor(p.name, i) }} />
                  {p.name} ({pct}%)
                </span>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Summary donut */}
        <SectionCard title="نسبة المبيعات لكل نوع" icon={PieChartIcon} className="lg:col-span-4">
          <div className="relative h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "مبيعات", value: stats.sales },
                    { name: "مايجريشن", value: stats.migration },
                  ]}
                  dataKey="value" innerRadius={65} outerRadius={95} paddingAngle={2}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#3b82f6" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{totalForSummary}</span>
              <span className="text-xs text-slate-400">الإجمالي</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-green-500" />
              مبيعات ({stats.sales} — {totalForSummary > 0 ? ((stats.sales / totalForSummary) * 100).toFixed(1) : "0.0"}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
              مايجريشن ({stats.migration} — {totalForSummary > 0 ? ((stats.migration / totalForSummary) * 100).toFixed(2) : "0.0"}%)
            </span>
          </div>
        </SectionCard>

        {/* Breakdown table */}
        <SectionCard title="تفاصيل المبيعات" icon={ClipboardList} className="lg:col-span-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">النوع</th>
                  <th className="text-right py-2 font-medium">عدد الخطوط</th>
                  <th className="text-right py-2 font-medium">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "مبيعات", value: stats.sales, pct: salesPercent, color: "bg-green-500" },
                  { label: "مايجريشن", value: stats.migration, pct: migrationPercent, color: "bg-blue-500" },
                  { label: "الغير مباع", value: stats.unsold, pct: unsoldPercent, color: "bg-red-500" },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-slate-50">
                    <td className="py-2.5 flex items-center gap-2 text-slate-700">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block ${row.color}`} />
                      {row.label}
                    </td>
                    <td className="py-2.5 text-slate-900 font-semibold">{row.value}</td>
                    <td className="py-2.5 text-slate-700">{row.pct}%</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/60 font-semibold text-blue-700">
                  <td className="py-2.5 px-2 rounded-r-lg">الإجمالي</td>
                  <td className="py-2.5">{stats.totalLines}</td>
                  <td className="py-2.5 px-2 rounded-l-lg">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Daily table */}
        <SectionCard title="تفاصيل المبيعات اليومية" icon={Calendar} className="lg:col-span-4">
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">التاريخ</th>
                  <th className="text-right py-2 font-medium">مبيعات</th>
                  <th className="text-right py-2 font-medium">مايجريشن</th>
                  <th className="text-right py-2 font-medium">غير مباع</th>
                  <th className="text-right py-2 font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {dailySales.map((d) => (
                  <tr key={d.date} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500">{d.date}</td>
                    <td className="py-2 text-green-600 font-medium">{d.sales}</td>
                    <td className="py-2 text-blue-600 font-medium">{d.migration}</td>
                    <td className="py-2 text-red-500 font-medium">{d.unsold}</td>
                    <td className="py-2 text-slate-900 font-semibold">{d.total}</td>
                  </tr>
                ))}
                {dailySales.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}