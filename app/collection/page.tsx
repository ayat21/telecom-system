"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  BarChart2, Loader2, Download, PhoneCall, CheckCircle2,
  XCircle, DollarSign, TrendingUp, RefreshCw, Percent, FileBarChart2,
} from "lucide-react";

const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function getProviderColor(name: string) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("etisalat") || lower.includes("اتصالات")) return "#22c55e";
  if (lower.includes("orange") || lower.includes("اورنج")) return "#f97316";
  if (lower.includes("vodafone") || lower.includes("فودافون")) return "#ef4444";
  return "#3b82f6";
}

export default function CollectionDashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filters
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [heiaatList, setHeiaatList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [filterPlace, setFilterPlace] = useState("");       // "a_5" أو "h_3"
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  // Data
  const [providerStats, setProviderStats] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    totalLines: 0,
    paidLines: 0,
    unpaidLines: 0,
    totalRevenue: 0,     // المطلوب
    totalCollected: 0,   // المحصل
  });
  const [unpaidList, setUnpaidList] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);

    // جيبي المنافذ والهيئات والأقسام
    Promise.all([
      supabase.from("almanafiz").select("id, name").order("name"),
      supabase.from("heiaat").select("id, name").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]).then(([{ data: a }, { data: h }, { data: d }]) => {
      setAlmanafizList(a || []);
      setHeiaatList(h || []);
      setDepartmentsList(d || []);
    });
  }, []);

  // ─── Load data ────────────────────────────────────────────
  async function loadData() {
    if (!filterMonth) { alert("اختاري الشهر الأول"); return; }
    setLoading(true);
    setDataLoaded(false);

    // ─── جيبي الخطوط حسب الفلاتر ──────────────────────────
    function buildQuery() {
      let q = supabase
        .from("lines")
        .select(`
          id, number, total_price, provider_id,
          providers(name), clients(name)
        `)
        .or("is_deleted.is.null,is_deleted.eq.false");

      if (filterPlace) {
        const [type, id] = filterPlace.split("_");
        if (type === "a") q = q.eq("almanafiz_id", Number(id));
        else q = q.eq("heiaat_id", Number(id));
      }
      if (filterDepartment) {
        q = q.eq("department_id", Number(filterDepartment));
      }
      return q;
    }

    // جيبي كل الخطوط في batches
    const allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await buildQuery().range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allLines.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // ─── جيبي السدادات للشهر ده ──────────────────────────
    const paidNumbers = new Set<string>();
    const paidAmounts = new Map<string, number>();
    let pOffset = 0;
    while (true) {
      const { data } = await supabase
        .from("payments")
        .select("line_number, amount")
        .eq("payment_month", filterMonth)
        .range(pOffset, pOffset + 999);
      if (!data || data.length === 0) break;
      data.forEach((p) => {
        if (p.line_number) {
          paidNumbers.add(p.line_number);
          paidAmounts.set(p.line_number, (paidAmounts.get(p.line_number) || 0) + (p.amount || 0));
        }
      });
      if (data.length < 1000) break;
      pOffset += 1000;
    }

    // ─── احسبي الإحصائيات ─────────────────────────────────
    const provMap = new Map<string, {
      total: number; paid: number; unpaid: number;
      revenue: number; collected: number; color: string;
    }>();
    let totalRevenue = 0;
    let totalCollected = 0;
    let paidCount = 0;
    const unpaid: any[] = [];

    allLines.forEach((line: any) => {
      const provName = line.providers?.name || "غير محدد";
      if (!provMap.has(provName)) {
        provMap.set(provName, {
          total: 0, paid: 0, unpaid: 0, revenue: 0, collected: 0,
          color: getProviderColor(provName),
        });
      }
      const prov = provMap.get(provName)!;
      prov.total++;
      prov.revenue += line.total_price || 0;
      totalRevenue += line.total_price || 0;

      const isPaid = paidNumbers.has(line.number);
      if (isPaid) {
        prov.paid++;
        paidCount++;
        const collected = paidAmounts.get(line.number) || 0;
        prov.collected += collected;
        totalCollected += collected;
      } else {
        prov.unpaid++;
        unpaid.push({
          number: line.number,
          client: line.clients?.name || "—",
          provider: provName,
          amount: line.total_price || 0,
        });
      }
    });

    setProviderStats(
      [...provMap.entries()].map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total)
    );
    setTotals({
      totalLines: allLines.length,
      paidLines: paidCount,
      unpaidLines: allLines.length - paidCount,
      totalRevenue,
      totalCollected,
    });
    setUnpaidList(unpaid);
    setDataLoaded(true);
    setLoading(false);
  }

  // ─── Export unpaid ────────────────────────────────────────
  function exportUnpaid() {
    if (unpaidList.length === 0) return;
    const rows = unpaidList.map((u) => ({
      "رقم الخط": u.number,
      "العميل": u.client,
      "الشبكة": u.provider,
      "المبلغ المطلوب": u.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "غير مسدد");
    XLSX.writeFile(wb, `unpaid-${filterMonth}.xlsx`);
  }

  if (!authorized) return null;

  const collectionRate = totals.totalLines > 0
    ? ((totals.paidLines / totals.totalLines) * 100)
    : 0;

  const paymentRate = totals.totalRevenue > 0
    ? ((totals.totalCollected / totals.totalRevenue) * 100)
    : 0;

  const selectedDeptName = filterDepartment
    ? departmentsList.find((d) => String(d.id) === filterDepartment)?.name
    : "كل الأقسام";

  const monthLabel = filterMonth
    ? (() => {
        const [y, m] = filterMonth.split("-");
        return `${MONTH_NAMES_AR[Number(m) - 1]} ${y}`;
      })()
    : "";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">متابعة التحصيل</h1>
            <p className="text-base text-slate-500 mt-0.5">المسدد والغير مسدد حسب القسم والمنفذ والشهر</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <div className="grid md:grid-cols-4 gap-3">
            {/* القسم */}
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">القسم</label>
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">كل الأقسام</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* المنفذ/الهيئة */}
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">المنفذ / الهيئة</label>
              <select value={filterPlace} onChange={(e) => setFilterPlace(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">الكل</option>
                <optgroup label="المنافذ">
                  {almanafizList.map((a) => (
                    <option key={`a_${a.id}`} value={`a_${a.id}`}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="الهيئات">
                  {heiaatList.map((h) => (
                    <option key={`h_${h.id}`} value={`h_${h.id}`}>{h.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* الشهر */}
            <div>
              <label className="block text-sm text-slate-500 mb-1.5">شهر السداد *</label>
              <input type="month" value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            {/* زرار */}
            <div className="flex items-end">
              <button onClick={loadData} disabled={loading || !filterMonth}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-base transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                عرض البيانات
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل البيانات...
          </div>
        )}

        {/* Empty state */}
        {!loading && !dataLoaded && (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            اختاري الفلاتر واضغطي "عرض البيانات"
          </div>
        )}

        {/* No results */}
        {!loading && dataLoaded && totals.totalLines === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            لا توجد خطوط بالفلاتر المحددة
          </div>
        )}

        {!loading && dataLoaded && totals.totalLines > 0 && (
          <>
            {/* كارت العنوان — القسم والشهر المختارين */}
            <div className="bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm mb-6 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <FileBarChart2 className="w-6 h-6 text-white" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">
                  تقرير نسبة السداد والتحصيل لـ {selectedDeptName}
                </h2>
                <p className="text-base text-blue-100 mt-0.5">عن شهر {monthLabel}</p>
              </div>
            </div>

            {/* KPI Cards — 7 كروت، نفس التصميم الأبيض بالظبط */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">إجمالي الخطوط</p>
                  <PhoneCall className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-2">{totals.totalLines.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">اجمالى المسدد</p>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-600 mt-2">{totals.paidLines.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">اجمالى الغير مسدد</p>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-500 mt-2">{totals.unpaidLines.toLocaleString()}</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">إجمالي المطلوب</p>
                  <DollarSign className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-purple-600 mt-2">{totals.totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-slate-400 mt-0.5">جنيه</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">إجمالي المحصل</p>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-600 mt-2">{totals.totalCollected.toLocaleString()}</p>
                <p className="text-sm text-slate-400 mt-0.5">جنيه</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">نسبة السداد</p>
                  <Percent className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-blue-600 mt-2">{collectionRate.toFixed(1)}%</p>
                <p className="text-sm text-slate-400 mt-0.5">{totals.paidLines.toLocaleString()} من {totals.totalLines.toLocaleString()} خط</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">نسبة التحصيل</p>
                  <DollarSign className="w-4 h-4 text-teal-500" />
                </div>
                <p className="text-3xl font-bold text-teal-600 mt-2">{paymentRate.toFixed(1)}%</p>
                <p className="text-sm text-slate-400 mt-0.5">{totals.totalCollected.toLocaleString()} من {totals.totalRevenue.toLocaleString()} جنيه</p>
              </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {providerStats.map((p) => {
                const rate = p.total > 0 ? Math.round((p.paid / p.total) * 100) : 0;
                return (
                  <div key={p.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <h3 className="font-bold text-slate-800 text-lg">{p.name}</h3>
                      </div>
                      <span className="text-sm font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `${p.color}15`, color: p.color }}>
                        {rate}% نسبة السداد
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-slate-900">{p.total.toLocaleString()}</p>
                        <p className="text-sm text-slate-400 mt-0.5">إجمالي</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-green-600">{p.paid.toLocaleString()}</p>
                        <p className="text-sm text-slate-400 mt-0.5">مسدد</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-red-500">{p.unpaid.toLocaleString()}</p>
                        <p className="text-sm text-slate-400 mt-0.5">غير مسدد</p>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${rate}%`, backgroundColor: p.color }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">
                        المطلوب: <strong className="text-slate-800">{p.revenue.toLocaleString()}</strong>
                      </span>
                      <span className="text-slate-500">
                        المحصل: <strong className="text-green-600">{p.collected.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unpaid List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-700">
                  الخطوط الغير مسددة ({unpaidList.length.toLocaleString()})
                </h2>
                <button onClick={exportUnpaid}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm transition">
                  <Download className="w-4 h-4" /> تحميل Excel
                </button>
              </div>
              <div className="overflow-auto max-h-96">
                <table className="w-full text-base">
                  <thead className="bg-slate-50 text-slate-500 text-sm sticky top-0">
                    <tr>
                      <th className="p-3 text-right font-medium">رقم الخط</th>
                      <th className="p-3 text-right font-medium">العميل</th>
                      <th className="p-3 text-right font-medium">الشبكة</th>
                      <th className="p-3 text-right font-medium">المبلغ المطلوب</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {unpaidList.slice(0, 200).map((u, i) => (
                      <tr key={`${u.number}-${i}`} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-medium">{u.number}</td>
                        <td className="p-3">{u.client}</td>
                        <td className="p-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-sm bg-slate-100">
                            {u.provider}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-red-500">{u.amount.toLocaleString()} جنيه</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {unpaidList.length > 200 && (
                  <p className="text-center text-sm text-slate-400 py-3">
                    معروض أول 200 — حمّلي الـ Excel لكل القائمة
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}