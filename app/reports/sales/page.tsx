"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  ShoppingBag,
  ArrowRightLeft,
  EyeOff,
  PieChart as PieChartIcon,
  Users,
  ClipboardList,
  Filter,
  Calendar,
  ChevronLeft,
  Star,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
// شكل الصف الراجع من Supabase بعد الـ join مع customers و providers
// لاحظي: select المتداخل بيرجع object مش array لأنها علاقة one-to-one (FK)



interface DailyRow {
  date: string;
  sales: number;
  migration: number;
  unsold: number;
  total: number;
}

interface AgentRow {
  name: string;
  sales: number;
}

interface ProviderRow {
  name: string;
  value: number;
}

  

// ============================================================
// Constants
// ============================================================

const COLORS = ["#22c55e", "#f97316", "#ef4444", "#3b82f6", "#a855f7"];
const PROVIDER_COLORS: Record<string, string> = {
  "اتصالات": "#22c55e",
  "اورنج": "#f97316",
  "فودافون": "#ef4444",
};

function getProviderColor(name: string, index: number) {
  return PROVIDER_COLORS[name] ?? COLORS[index % COLORS.length];
}

// ============================================================
// Small UI helpers
// ============================================================

function StatCard({
  label,
  value,
  suffix,
  subLabel,
  subValue,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  subLabel?: string;
  subValue?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-sm">{label}</p>
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </span>
      </div>
      <div className="mt-3">
        <h2 className={`text-3xl font-bold ${valueColor}`}>
          {value}
          {suffix && (
            <span className="text-base font-normal text-slate-400 mr-1">
              {suffix}
            </span>
          )}
        </h2>
        {subLabel && (
          <p className="text-xs text-slate-400 mt-1">
            {subValue}
            <span className="mr-1">{subLabel}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  action,
  className = "",
  children,
}: {
  title: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {Icon && <Icon className="w-5 h-5 text-slate-300" />}
      </div>
      {children}
      {action}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function SalesPage() {
    const [lines, setLines] =
    useState<any[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [provider, setProvider] = useState("");
  const [agent, setAgent] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalLines: 0,
    sales: 0,
    migration: 0,
    newSales: 0,
    unsold: 0,
  });
  // --------------------------------------------------------
  // Data loading
  // --------------------------------------------------------
  // البيانات الحقيقية بتيجي من 3 جداول:
  // lines (department, agent, provider_id, customer_id)
  // providers (name) -> عن طريق provider_id
  // customers (customer_date_real) -> عن طريق customer_id
async function loadData() {
  setLoading(true);
  setErrorMsg(null);

  let query = supabase
    .from("lines")
    .select("*");

  if (fromDate) {
    query = query.gte(
      "customer_date_real",
      fromDate
    );
  }

  if (toDate) {
    query = query.lte(
      "customer_date_real",
      toDate
    );
  }

  if (provider) {
    query = query.eq(
      "provider_name",
      provider
    );
  }

  if (agent) {
    query = query.eq(
      "agent_name",
      agent
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.log(error);
    setLoading(false);
    return;
  }

  const result = data || [];

  setLines(result);

  const totalLines =
    result.length;

  const migration =
    result.filter(
      (x) =>
        x.department ===
        "مايجريشن"
    ).length;

  const unsold =
    result.filter(
      (x) => !x.department
    ).length;

  const sales =
    result.filter(
      (x) =>
        x.department &&
        x.department !==
          "مايجريشن"
    ).length;

  setStats({
    totalLines,
    sales,
    migration,
    newSales: sales,
    unsold,
  });

  setLoading(false);
}

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------
  // قائمة الشبكات بترجع من جدول providers المستقل
  // عشان تفضل ثابتة حتى لو نتيجة lines فاضية بعد الفلترة
  // --------------------------------------------------------

 const providersList =
  useMemo(
    () =>
      [
        ...new Set(
          lines
            .map(
              (x: any) =>
                x.provider_name
            )
            .filter(Boolean)
        ),
      ],
    [lines]
  );

  // قائمة البائعين بتتجمع من البيانات الفعلية (لإن مفيش جدول agents مستقل)
  const agents = useMemo(
    () =>
      [...new Set(lines.map((x) => x.agent_name).filter((a) => a !== "غير محدد"))] as string[],
    [lines]
  );

  // --------------------------------------------------------
  // Derived chart / table data
  // --------------------------------------------------------

  const agentData: AgentRow[] = useMemo(() => {
    const map = lines.reduce((acc: Record<string, AgentRow>, item) => {
      const name = item.agent_name;
      if (!acc[name]) acc[name] = { name, sales: 0 };
      acc[name].sales++;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => b.sales - a.sales);
  }, [lines]);

  const topAgents = useMemo(() => agentData.slice(0, 10), [agentData]);

  const providerData: ProviderRow[] = useMemo(() => {
    const map = lines.reduce((acc: Record<string, ProviderRow>, item) => {
      const name = item.provider_name;
      if (!acc[name]) acc[name] = { name, value: 0 };
      acc[name].value++;
      return acc;
    }, {});
    return Object.values(map);
  }, [lines]);

  const dailySales: DailyRow[] = useMemo(() => {
    const map = lines.reduce((acc: Record<string, DailyRow>, item) => {
      const date = item.customer_date_real || "غير محدد";
      if (!acc[date]) {
        acc[date] = { date, sales: 0, migration: 0, unsold: 0, total: 0 };
      }
      acc[date].total++;
      if (item.department === "مايجريشن") {
        acc[date].migration++;
      } else if (!item.department) {
        acc[date].unsold++;
      } else {
        acc[date].sales++;
      }
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [lines]);

  const salesPercent =
    stats.totalLines > 0
      ? ((stats.sales / stats.totalLines) * 100).toFixed(2)
      : "0.00";

  const migrationPercent =
    stats.totalLines > 0
      ? ((stats.migration / stats.totalLines) * 100).toFixed(2)
      : "0.00";

  const unsoldPercent =
    stats.totalLines > 0
      ? ((stats.unsold / stats.totalLines) * 100).toFixed(2)
      : "0.00";

  const totalForSummary = stats.sales + stats.migration;

  // --------------------------------------------------------
  // Export to Excel (xlsx)
  // --------------------------------------------------------

  async function exportReport() {
    const XLSX = await import("xlsx");

    const summarySheet = [
      ["البند", "العدد", "النسبة من الإجمالي"],
      ["مبيعات", stats.sales, `${salesPercent}%`],
      ["مايجريشن", stats.migration, `${migrationPercent}%`],
      ["غير مباع", stats.unsold, `${unsoldPercent}%`],
      ["الإجمالي", stats.totalLines, "100.00%"],
    ];

    const dailySheet = [
      ["التاريخ", "مبيعات", "مايجريشن", "الغير مباع", "الإجمالي"],
      ...dailySales.map((d) => [d.date, d.sales, d.migration, d.unsold, d.total]),
    ];

    const agentsSheet = [
      ["#", "البائع", "إجمالي المبيعات"],
      ...agentData.map((a, i) => [i + 1, a.name, a.sales]),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(summarySheet),
      "ملخص"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(dailySheet),
      "المبيعات اليومية"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(agentsSheet),
      "البائعين"
    );

    XLSX.writeFile(wb, `تقرير_المبيعات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              تقرير المبيعات
            </h1>
            <ClipboardList className="w-7 h-7 text-blue-500" />
          </div>
          <p className="text-slate-500 mt-1">
            تحليل شامل لأداء المبيعات في الفترة المحددة
          </p>
        </div>

        <button
          onClick={exportReport}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 shadow-sm hover:bg-slate-50 transition self-start"
        >
          <Download className="w-4 h-4" />
          <span className="font-medium">تصدير تقرير</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <div>
            <label className="block text-xs text-slate-400 mb-1">من تاريخ</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">إلى تاريخ</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">البائع</label>
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">كل البائعين</option>
              {agents.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">الشبكة</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">كل الشبكات</option>
              {providersList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl p-2.5 font-medium text-sm transition self-end"
          >
            <Filter className="w-4 h-4" />
            {loading ? "جارٍ التحميل..." : "تصفية"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="إجمالي المبيعات"
          value={stats.sales}
          suffix="خط"
          subLabel="% من الإجمالي"
          subValue={`${salesPercent}`}
          icon={ShoppingBag}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          valueColor="text-green-600"
        />

        <StatCard
          label="إجمالي مايجريشن"
          value={stats.migration}
          suffix="خط"
          subLabel="% من الإجمالي"
          subValue={`${migrationPercent}`}
          icon={ArrowRightLeft}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          valueColor="text-orange-600"
        />

        <StatCard
          label="الغير مباع"
          value={stats.unsold}
          suffix="خط"
          subLabel="% من الإجمالي"
          subValue={`${unsoldPercent}`}
          icon={EyeOff}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor="text-red-600"
        />

        <StatCard
          label="نسبة المبيعات"
          value={`${salesPercent}%`}
          subLabel="من إجمالي الخطوط"
          icon={PieChartIcon}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          valueColor="text-purple-600"
        />

        <StatCard
          label="نسبة مايجريشن"
          value={`${migrationPercent}%`}
          subLabel="من إجمالي الخطوط"
          icon={Users}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          valueColor="text-rose-600"
        />

        <StatCard
          label="إجمالي الخطوط"
          value={stats.totalLines}
          suffix="خط"
          icon={ClipboardList}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          valueColor="text-slate-900"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Bar chart by agent */}
        <SectionCard
          title="مبيعات حسب البائع"
          icon={ClipboardList}
          className="lg:col-span-5"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    direction: "rtl",
                  }}
                />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Top agents table */}
        <SectionCard
          title="أفضل 10 بائعين"
          icon={Star}
          className="lg:col-span-3"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">#</th>
                  <th className="text-right py-2 font-medium">البائع</th>
                  <th className="text-right py-2 font-medium">إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((item, index) => (
                  <tr
                    key={item.name}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2 text-slate-400">{index + 1}</td>
                    <td className="py-2 text-slate-700">{item.name}</td>
                    <td className="py-2 text-slate-900 font-semibold">
                      {item.sales}
                    </td>
                  </tr>
                ))}
                {topAgents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="flex items-center gap-1 text-blue-600 text-sm font-medium mt-3 hover:underline">
            عرض كل البائعين
            <ChevronLeft className="w-4 h-4" />
          </button>
        </SectionCard>

        {/* Provider distribution */}
        <SectionCard
          title="توزيع المبيعات حسب الشبكة"
          icon={PieChartIcon}
          className="lg:col-span-4"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ percent }) =>
                    `${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                >
                  {providerData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={getProviderColor(entry.name, index)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    direction: "rtl",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs flex-wrap">
            {providerData.map((p, i) => {
              const pct =
                lines.length > 0
                  ? ((p.value / lines.length) * 100).toFixed(1)
                  : "0.0";
              return (
                <span key={p.name} className="flex items-center gap-1 text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: getProviderColor(p.name, i) }}
                  />
                  {p.name} ({pct}%)
                </span>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Bottom row: summary donut, breakdown table, daily table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Summary donut sales vs migration */}
        <SectionCard
          title="نسبة المبيعات لكل نوع"
          icon={PieChartIcon}
          className="lg:col-span-4"
        >
          <div className="relative h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "مبيعات", value: stats.sales },
                    { name: "مايجريشن", value: stats.migration },
                  ]}
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#3b82f6" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    direction: "rtl",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">
                {totalForSummary}
              </span>
              <span className="text-xs text-slate-400">الإجمالي</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-green-500" />
              مبيعات ({stats.sales} —{" "}
              {totalForSummary > 0
                ? ((stats.sales / totalForSummary) * 100).toFixed(1)
                : "0.0"}
              %)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
              مايجريشن ({stats.migration} —{" "}
              {totalForSummary > 0
                ? ((stats.migration / totalForSummary) * 100).toFixed(1)
                : "0.0"}
              %)
            </span>
          </div>
        </SectionCard>

        {/* Breakdown by type table */}
        <SectionCard title="تفاصيل المبيعات" icon={ClipboardList} className="lg:col-span-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">النوع</th>
                  <th className="text-right py-2 font-medium">عدد الخطوط</th>
                  <th className="text-right py-2 font-medium">النسبة من الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="py-2.5 flex items-center gap-2 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full inline-block bg-green-500" />
                    مبيعات
                  </td>
                  <td className="py-2.5 text-slate-900 font-semibold">
                    {stats.sales}
                  </td>
                  <td className="py-2.5 text-slate-700">{salesPercent}%</td>
                </tr>
                <tr className="border-b border-slate-50">
                  <td className="py-2.5 flex items-center gap-2 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
                    مايجريشن
                  </td>
                  <td className="py-2.5 text-slate-900 font-semibold">
                    {stats.migration}
                  </td>
                  <td className="py-2.5 text-slate-700">{migrationPercent}%</td>
                </tr>
                <tr className="border-b border-slate-50">
                  <td className="py-2.5 flex items-center gap-2 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-500" />
                    الغير مباع
                  </td>
                  <td className="py-2.5 text-slate-900 font-semibold">
                    {stats.unsold}
                  </td>
                  <td className="py-2.5 text-slate-700">{unsoldPercent}%</td>
                </tr>
                <tr className="bg-blue-50/60 font-semibold text-blue-700">
                  <td className="py-2.5 px-2 rounded-r-lg">الإجمالي</td>
                  <td className="py-2.5">{stats.totalLines}</td>
                  <td className="py-2.5 px-2 rounded-l-lg">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Daily sales detail table */}
        <SectionCard
          title="تفاصيل المبيعات اليومية"
          icon={Calendar}
          className="lg:col-span-4"
        >
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="text-right py-2 font-medium">التاريخ</th>
                  <th className="text-right py-2 font-medium">مبيعات</th>
                  <th className="text-right py-2 font-medium">مايجريشن</th>
                  <th className="text-right py-2 font-medium">الغير مباع</th>
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
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}