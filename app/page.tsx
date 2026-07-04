"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PhoneCall, TrendingUp, ArrowRightLeft, DollarSign,
  Users, Network, Activity, Package, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const MIGRATION_DEPT_ID = 10;
const COLORS = ["#22c55e", "#f97316", "#ef4444", "#3b82f6", "#a855f7", "#06b6d4"];

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <p className="text-3xl font-bold text-slate-900 mt-3">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState({
    totalLines: 0,
    sales: 0,
    migration: 0,
    unsold: 0,
    totalRevenue: 0,
    totalClients: 0,
  });

  const [providerData, setProviderData] = useState<any[]>([]);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [almanafizData, setAlmanafizData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [recentLines, setRecentLines] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);

    // آخر 30 يوم
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().split("T")[0];

    const [
      { data: lines },
      { data: clients },
      { data: providers },
      { data: agents },
      { data: almanafiz },
      { data: lineStatuses },
      { data: recent },
    ] = await Promise.all([
      supabase.from("lines")
        .select("id, department_id, provider_id, agent_id, almanafiz_id, line_status_id, total_price, customer_date_real, providers(name), agents(name), almanafiz(name), line_statuses(name)")
        .or("is_deleted.is.null,is_deleted.eq.false"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("providers").select("id, name"),
      supabase.from("agents").select("id, name"),
      supabase.from("almanafiz").select("id, name"),
      supabase.from("line_statuses").select("id, name"),
      supabase.from("lines")
        .select("id, number, customer_date_real, total_price, clients(name), providers(name)")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("id", { ascending: false })
        .limit(8),
    ]);

    const all = lines || [];

    // ─── KPIs ─────────────────────────────────────────────
    const sales = all.filter((x) => x.department_id && x.department_id !== MIGRATION_DEPT_ID).length;
    const migration = all.filter((x) => x.department_id === MIGRATION_DEPT_ID).length;
    const unsold = all.filter((x) => !x.department_id).length;
    const totalRevenue = all.reduce((s, x) => s + (x.total_price || 0), 0);

    setKpis({
      totalLines: all.length,
      sales,
      migration,
      unsold,
      totalRevenue,
      totalClients: clients?.length || 0,
    });

    // ─── Providers ────────────────────────────────────────
    const provMap = new Map<string, number>();
    all.forEach((x) => {
      const name = (x.providers as any)?.name || "غير محدد";
      provMap.set(name, (provMap.get(name) || 0) + 1);
    });
    setProviderData([...provMap.entries()].map(([name, value]) => ({ name, value })));

    // ─── Top 5 Agents ─────────────────────────────────────
    const agentMap = new Map<string, number>();
    all.forEach((x) => {
      const agentName = (x.agents as any)?.name;
      if (!agentName) return;
      agentMap.set(agentName, (agentMap.get(agentName) || 0) + 1);
    });
    setAgentData(
      [...agentMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    // ─── Top 5 Almanafiz ──────────────────────────────────
    const almMap = new Map<string, number>();
    all.forEach((x) => {
      const almanafizName = (x.almanafiz as any)?.name;
      if (!almanafizName) return;
      almMap.set(almanafizName, (almMap.get(almanafizName) || 0) + 1);
    });
    setAlmanafizData(
      [...almMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    // ─── Daily last 30 days ───────────────────────────────
    const dayMap = new Map<string, { sales: number; migration: number }>();
    all
      .filter((x) => x.customer_date_real && x.customer_date_real >= fromStr)
      .forEach((x) => {
        const d = x.customer_date_real;
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

    // ─── Line Statuses ────────────────────────────────────
    const statusMap = new Map<string, number>();
    all.forEach((x) => {
      const statusName = (x.line_statuses as any)?.name;
      if (!statusName) return;
      statusMap.set(statusName, (statusMap.get(statusName) || 0) + 1);
    });
    setStatusData(
      [...statusMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    );

    setRecentLines(recent || []);
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
    </div>
  );

  const salesPercent = kpis.totalLines > 0 ? ((kpis.sales / kpis.totalLines) * 100).toFixed(1) : "0";
  const migrationPercent = kpis.totalLines > 0 ? ((kpis.migration / kpis.totalLines) * 100).toFixed(1) : "0";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">لوحة التحكم</h1>
          <p className="text-sm text-slate-400 mt-1">نظرة شاملة على أداء المبيعات والخطوط</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KpiCard label="إجمالي الخطوط" value={kpis.totalLines.toLocaleString()}
            icon={PhoneCall} color="bg-blue-50 text-blue-600" />
          <KpiCard label="مبيعات" value={kpis.sales.toLocaleString()}
            sub={`${salesPercent}% من الإجمالي`}
            icon={TrendingUp} color="bg-green-50 text-green-600" />
          <KpiCard label="مايجريشن" value={kpis.migration.toLocaleString()}
            sub={`${migrationPercent}% من الإجمالي`}
            icon={ArrowRightLeft} color="bg-orange-50 text-orange-600" />
          <KpiCard label="غير مباع" value={kpis.unsold.toLocaleString()}
            icon={Activity} color="bg-red-50 text-red-600" />
          <KpiCard label="إجمالي الإيرادات" value={kpis.totalRevenue.toLocaleString()}
            sub="جنيه" icon={DollarSign} color="bg-purple-50 text-purple-600" />
          <KpiCard label="إجمالي العملاء" value={kpis.totalClients.toLocaleString()}
            icon={Users} color="bg-teal-50 text-teal-600" />
        </div>

        {/* Row 1: Daily Chart + Providers Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Daily Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">المبيعات اليومية — آخر 30 يوم</h2>
            {dailyData.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} barGap={2}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl", fontSize: 12 }} />
                    <Bar dataKey="sales" name="مبيعات" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="migration" name="مايجريشن" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات</div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />مبيعات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />مايجريشن</span>
            </div>
          </div>

          {/* Providers Pie */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">توزيع الخطوط بالشبكة</h2>
            {providerData.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={providerData} dataKey="value" nameKey="name"
                        innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {providerData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", direction: "rtl", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {providerData.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {p.name}
                      </span>
                      <span className="font-semibold text-slate-800">{p.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات</div>
            )}
          </div>
        </div>

        {/* Row 2: Top Agents + Top Almanafiz + Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

          {/* Top 5 Agents */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">أفضل 5 مندوبين</h2>
            <div className="space-y-3">
              {agentData.map((a, i) => {
                const max = agentData[0]?.count || 1;
                const pct = Math.round((a.count / max) * 100);
                return (
                  <div key={a.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-200 text-slate-600"
                        }`}>{i + 1}</span>
                        {a.name}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{a.count}</span>
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

          {/* Top 5 Almanafiz */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">أفضل 5 منافذ</h2>
            <div className="space-y-3">
              {almanafizData.map((a, i) => {
                const max = almanafizData[0]?.count || 1;
                const pct = Math.round((a.count / max) * 100);
                return (
                  <div key={a.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-200 text-slate-600"
                        }`}>{i + 1}</span>
                        {a.name}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{a.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {almanafizData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات</p>}
            </div>
          </div>

          {/* Line Statuses */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-4">توزيع حالات الخطوط</h2>
            <div className="space-y-2.5">
              {statusData.map((s, i) => {
                const total = statusData.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600 truncate max-w-[140px]">{s.name}</span>
                      <span className="text-xs font-bold text-slate-800">{s.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {statusData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد بيانات</p>}
            </div>
          </div>
        </div>

        {/* Row 3: Recent Lines */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">آخر الخطوط المضافة</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium">رقم الخط</th>
                  <th className="p-3 text-right font-medium">العميل</th>
                  <th className="p-3 text-right font-medium">الشبكة</th>
                  <th className="p-3 text-right font-medium">تاريخ العميل</th>
                  <th className="p-3 text-right font-medium">إجمالي السعر</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {recentLines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-medium text-slate-900">{line.number}</td>
                    <td className="p-3">{line.clients?.name || "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                        {line.providers?.name || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{line.customer_date_real || "—"}</td>
                    <td className="p-3 font-semibold">{(line.total_price || 0).toLocaleString()} جنيه</td>
                  </tr>
                ))}
                {recentLines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">لا توجد بيانات</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}