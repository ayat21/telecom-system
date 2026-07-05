"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PhoneCall, TrendingUp, ArrowRightLeft, DollarSign,
  Users, Activity, Loader2, Bell, CreditCard,
  UserX, AlertCircle, Clock, X, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis,
} from "recharts";

const MIGRATION_DEPT_ID = 10;

function getProviderColor(name: string) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("etisalat") || lower.includes("اتصالات")) return "#22c55e";
  if (lower.includes("orange") || lower.includes("اورنج")) return "#f97316";
  if (lower.includes("vodafone") || lower.includes("فودافون")) return "#ef4444";
  return "#3b82f6";
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </span>
      </div>
      <div className="mt-3">
        <p className={`text-3xl font-bold ${valueColor || "text-slate-900"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [providersList, setProvidersList] = useState<any[]>([]);

  const [kpis, setKpis] = useState({
    totalLines: 0, sales: 0, migration: 0, unsold: 0,
    totalRevenue: 0, totalClients: 0,
    todayPayments: 0, todayPaymentsAmount: 0,
    linesWithoutClient: 0,
  });

  const [providerData, setProviderData] = useState<any[]>([]);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("full_name") || "";
    setFullName(name);
    if (!role) { router.replace("/login"); return; }

    // جيبي الشبكات
    supabase.from("providers").select("id, name").then(({ data }) => setProvidersList(data || []));
    loadAll("", "");
  }, []);

  // ─── helpers ──────────────────────────────────────────────
  function applyBase(q: any, fromDate: string, provId: string) {
    q = q.or("is_deleted.is.null,is_deleted.eq.false");
    if (fromDate) q = q.gte("customer_date_real", fromDate);
    if (provId) q = q.eq("provider_id", Number(provId));
    return q;
  }

  async function loadAll(fromDate: string, provId: string) {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const from30 = new Date();
    from30.setDate(from30.getDate() - 30);
    const fromStr = fromDate || from30.toISOString().split("T")[0];

    // ─── KPIs ─────────────────────────────────────────────
    const baseFilter = (q: any) => applyBase(q, fromDate, provId);

    const [
      { count: totalLines },
      { count: salesCount },
      { count: migrationCount },
      { count: unsoldCount },
      { count: clientsCount },
      { count: linesWithoutClientCount },
    ] = await Promise.all([
      baseFilter(supabase.from("lines").select("*", { count: "exact", head: true })),
      baseFilter(supabase.from("lines").select("*", { count: "exact", head: true }))
        .not("department_id", "is", null).neq("department_id", MIGRATION_DEPT_ID),
      baseFilter(supabase.from("lines").select("*", { count: "exact", head: true }))
        .eq("department_id", MIGRATION_DEPT_ID),
      baseFilter(supabase.from("lines").select("*", { count: "exact", head: true }))
        .is("department_id", null),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      baseFilter(supabase.from("lines").select("*", { count: "exact", head: true }))
        .is("client_id", null).not("department_id", "is", null).neq("department_id", MIGRATION_DEPT_ID),
    ]);

    // ─── إجمالي الإيرادات ─────────────────────────────────
    let totalRevenue = 0;
    let offset = 0;
    while (true) {
      const q = applyBase(supabase.from("lines").select("total_price"), fromDate, provId)
        .range(offset, offset + 999);
      const { data: revBatch } = await q;
      if (!revBatch || revBatch.length === 0) break;
      totalRevenue += revBatch.reduce((s: number, x: any) => s + (x.total_price || 0), 0);
      if (revBatch.length < 1000) break;
      offset += 1000;
    }

    // ─── مدفوعات اليوم ────────────────────────────────────
    const { data: todayPay } = await supabase
      .from("payments").select("amount").eq("trans_date", today);
    const todayAmount = (todayPay || []).reduce((s, p) => s + (p.amount || 0), 0);

    setKpis({
      totalLines: totalLines || 0,
      sales: salesCount || 0,
      migration: migrationCount || 0,
      unsold: unsoldCount || 0,
      totalRevenue,
      totalClients: clientsCount || 0,
      todayPayments: todayPay?.length || 0,
      todayPaymentsAmount: todayAmount,
      linesWithoutClient: linesWithoutClientCount || 0,
    });

    // ─── توزيع الشبكات ────────────────────────────────────
    const { data: pList } = await supabase.from("providers").select("id, name");
    const providerCounts = await Promise.all(
      (pList || []).map(async (p) => {
        const q = applyBase(
          supabase.from("lines").select("*", { count: "exact", head: true }),
          fromDate, provId
        ).eq("provider_id", p.id);
        const { count } = await q;
        return { name: p.name, value: count || 0, color: getProviderColor(p.name) };
      })
    );
    setProviderData(providerCounts.filter((p) => p.value > 0).sort((a, b) => b.value - a.value));

    // ─── المبيعات اليومية ─────────────────────────────────
    const { data: dailyLines } = await applyBase(
      supabase.from("lines").select("customer_date_real, department_id"),
      fromStr, provId
    ).gte("customer_date_real", fromStr).limit(100000);

    const dayMap = new Map<string, { sales: number; migration: number }>();
    (dailyLines || []).forEach((x: any) => {
      const d = x.customer_date_real;
      if (!d) return;
      if (!dayMap.has(d)) dayMap.set(d, { sales: 0, migration: 0 });
      const entry = dayMap.get(d)!;
      if (x.department_id === MIGRATION_DEPT_ID) entry.migration++;
      else if (x.department_id) entry.sales++;
    });
    setDailyData(
      [...dayMap.entries()]
        .map(([date, v]) => ({ date: date.slice(5), ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );

    // ─── أفضل 5 مندوبين ───────────────────────────────────
    const { data: agentLines } = await applyBase(
      supabase.from("lines").select("agent_id, total_price, agents(name)"),
      fromDate, provId
    ).not("agent_id", "is", null).limit(100000);

    const agentMap = new Map<string, { count: number; revenue: number }>();
    (agentLines || []).forEach((x: any) => {
      const name = x.agents?.name;
      if (!name) return;
      const cur = agentMap.get(name) || { count: 0, revenue: 0 };
      agentMap.set(name, { count: cur.count + 1, revenue: cur.revenue + (x.total_price || 0) });
    });
    setAgentData(
      [...agentMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    // ─── أفضل 5 جروبات من حيث الإيرادات ─────────────────
    const { data: groupLines } = await applyBase(
      supabase.from("lines").select("group_id, total_price, groups(name)"),
      fromDate, provId
    ).not("group_id", "is", null).limit(100000);

    const groupMap = new Map<string, { count: number; revenue: number }>();
    (groupLines || []).forEach((x: any) => {
      const name = x.groups?.name;
      if (!name) return;
      const cur = groupMap.get(name) || { count: 0, revenue: 0 };
      groupMap.set(name, { count: cur.count + 1, revenue: cur.revenue + (x.total_price || 0) });
    });
    setGroupData(
      [...groupMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    // ─── حالات الخطوط ─────────────────────────────────────
    const { data: statusLines } = await applyBase(
      supabase.from("lines").select("line_status_id, line_statuses(name)"),
      fromDate, provId
    ).not("line_status_id", "is", null).limit(100000);

    const statusMap = new Map<string, number>();
    (statusLines || []).forEach((x: any) => {
      const name = x.line_statuses?.name;
      if (!name) return;
      statusMap.set(name, (statusMap.get(name) || 0) + 1);
    });
    setStatusData(
      [...statusMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    );

    // ─── آخر العمليات ─────────────────────────────────────
    const { data: logs } = await supabase
      .from("audit_logs").select("*")
      .order("created_at", { ascending: false }).limit(6);
    setRecentLogs(logs || []);

    setLoading(false);
  }

  const salesPercent = kpis.totalLines > 0 ? ((kpis.sales / kpis.totalLines) * 100).toFixed(1) : "0";
  const migrationPercent = kpis.totalLines > 0 ? ((kpis.migration / kpis.totalLines) * 100).toFixed(1) : "0";

  function getActionLabel(type: string) {
    switch (type) {
      case "UPDATE": return { label: "تعديل", color: "bg-blue-100 text-blue-700" };
      case "DELETE": return { label: "حذف", color: "bg-red-100 text-red-700" };
      case "INSERT": return { label: "إضافة", color: "bg-green-100 text-green-700" };
      default: return { label: type, color: "bg-slate-100 text-slate-700" };
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-5 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">لوحة التحكم 👋</h1>
            <p className="text-slate-400 text-sm mt-0.5">مرحباً {fullName} — نظرة شاملة على أداء المبيعات</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date */}
            <div className="relative">
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => {
                  setFilterFromDate(e.target.value);
                  loadAll(e.target.value, filterProvider);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 pr-8"
              />
              {filterFromDate && (
                <button onClick={() => { setFilterFromDate(""); loadAll("", filterProvider); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Provider */}
            <select
              value={filterProvider}
              onChange={(e) => {
                setFilterProvider(e.target.value);
                loadAll(filterFromDate, e.target.value);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">كل الشبكات</option>
              {providersList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Reset */}
            {(filterFromDate || filterProvider) && (
              <button
                onClick={() => { setFilterFromDate(""); setFilterProvider(""); loadAll("", ""); }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-3 py-2.5 text-sm transition">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة تعيين
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل البيانات...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <KpiCard label="إجمالي الخطوط" value={kpis.totalLines}
                icon={PhoneCall} iconBg="bg-blue-50" iconColor="text-blue-600" />
              <KpiCard label="مبيعات" value={kpis.sales} sub={`${salesPercent}% من الإجمالي`}
                icon={TrendingUp} iconBg="bg-green-50" iconColor="text-green-600" valueColor="text-green-600" />
              <KpiCard label="مايجريشن" value={kpis.migration} sub={`${migrationPercent}% من الإجمالي`}
                icon={ArrowRightLeft} iconBg="bg-orange-50" iconColor="text-orange-600" valueColor="text-orange-600" />
              <KpiCard label="غير مباع" value={kpis.unsold}
                icon={Activity} iconBg="bg-red-50" iconColor="text-red-500" valueColor="text-red-500" />
              <KpiCard label="إجمالي الإيرادات" value={kpis.totalRevenue.toLocaleString()} sub="جنيه"
                icon={DollarSign} iconBg="bg-purple-50" iconColor="text-purple-600" valueColor="text-purple-600" />
              <KpiCard label="إجمالي العملاء" value={kpis.totalClients}
                icon={Users} iconBg="bg-teal-50" iconColor="text-teal-600" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

              {/* Area Chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-700">المبيعات اليومية — آخر 30 يوم</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />مبيعات</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />مايجريشن</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="migGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={4} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl", fontSize: 12 }} />
                      <Area type="monotone" dataKey="sales" name="مبيعات" stroke="#22c55e" strokeWidth={2} fill="url(#salesGrad)" />
                      <Area type="monotone" dataKey="migration" name="مايجريشن" stroke="#3b82f6" strokeWidth={2} fill="url(#migGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-4">توزيع الخطوط بالشبكة</h2>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={providerData} dataKey="value" nameKey="name"
                        innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {providerData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {providerData.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {p.value.toLocaleString()}
                        <span className="text-slate-400 font-normal mr-1">
                          ({kpis.totalLines > 0 ? ((p.value / kpis.totalLines) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

              {/* Top Agents */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-4">أفضل 5 مندوبين</h2>
                <div className="space-y-3">
                  {agentData.map((a, i) => {
                    const max = agentData[0]?.count || 1;
                    const pct = Math.round((a.count / max) * 100);
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div key={a.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span>{medals[i] || `${i + 1}.`}</span>
                            <span className="truncate max-w-[100px]">{a.name}</span>
                          </span>
                          <div className="text-left">
                            <span className="text-xs font-bold text-slate-800">{a.count.toLocaleString()}</span>
                            <span className="text-xs text-slate-400 mr-1">خط</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {agentData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات</p>}
                </div>
              </div>

              {/* Top Groups by Revenue */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-1">أفضل 5 جروبات — الإيرادات</h2>
                <p className="text-xs text-slate-400 mb-4">المنافذ والهيئات مجمعة بالجروب</p>
                <div className="space-y-3">
                  {groupData.map((g, i) => {
                    const max = groupData[0]?.revenue || 1;
                    const pct = Math.round((g.revenue / max) * 100);
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div key={g.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span>{medals[i] || `${i + 1}.`}</span>
                            <span className="truncate max-w-[100px]">{g.name}</span>
                          </span>
                          <div className="text-left">
                            <span className="text-xs font-bold text-purple-700">{g.revenue.toLocaleString()}</span>
                            <span className="text-xs text-slate-400 mr-1">جنيه</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{g.count.toLocaleString()} خط</p>
                      </div>
                    );
                  })}
                  {groupData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات</p>}
                </div>
              </div>

              {/* Alerts + Today Payments */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-700">التنبيهات</h2>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 text-red-600">
                        <UserX className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-medium">خطوط بدون عميل</span>
                      </div>
                      <span className="text-sm font-bold text-red-600">{kpis.linesWithoutClient.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-medium">خطوط غير مباعة</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">{kpis.unsold.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 text-green-600">
                        <CreditCard className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-medium">مدفوعات اليوم</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">{kpis.todayPayments.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4" />
                    <p className="text-sm font-medium opacity-90">إجمالي مدفوعات اليوم</p>
                  </div>
                  <p className="text-3xl font-bold">{kpis.todayPaymentsAmount.toLocaleString()}</p>
                  <p className="text-xs opacity-80 mt-1">جنيه — {kpis.todayPayments} معاملة</p>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Status */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-4">توزيع حالات الخطوط</h2>
                <div className="space-y-2.5">
                  {statusData.map((s, i) => {
                    const total = statusData.reduce((sum, x) => sum + x.count, 0);
                    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    const colors = ["#22c55e", "#3b82f6", "#f97316", "#ef4444", "#a855f7", "#06b6d4"];
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600 truncate max-w-[200px]">{s.name}</span>
                          <span className="text-xs font-bold text-slate-800">
                            {s.count.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                        </div>
                      </div>
                    );
                  })}
                  {statusData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات</p>}
                </div>
              </div>

              {/* Recent Logs */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-700">آخر العمليات</h2>
                </div>
                <div className="space-y-3">
                  {recentLogs.map((log) => {
                    const action = getActionLabel(log.action_type);
                    return (
                      <div key={log.id} className="flex items-start gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${action.color}`}>
                          {action.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{log.user_name || "—"}</p>
                          <p className="text-xs text-slate-400">{log.table_name}</p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">
                          {new Date(log.created_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                  {recentLogs.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد عمليات</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}