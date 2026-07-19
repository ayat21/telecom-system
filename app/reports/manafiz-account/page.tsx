"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileBarChart2, Loader2, Calendar, Download, Network, Building2, ImageDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 35;

interface OutletRow {
  almanafiz_id: number;
  name: string;
  groupName: string;
  total: number;
  paid: number;
  unpaid: number;
}

interface ProviderSummary {
  id: number;
  name: string;
  total: number;
  paid: number;
  unpaid: number;
  required: number;   // إجمالي المطلوب (مجموع total_price)
  collected: number;  // إجمالي المحصل الفعلي (مجموع مبالغ السدادات الحقيقية)
}

export default function ManafizAccountReportPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [filterMonth, setFilterMonth] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [providersList, setProvidersList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<number | null>(null);
  const [detailPage, setDetailPage] = useState(1);

  const [summary, setSummary] = useState<ProviderSummary[]>([]);
  const [outletsByProvider, setOutletsByProvider] = useState<Record<number, OutletRow[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    supabase.from("providers").select("id, name").order("name")
      .then(({ data }) => {
        setProvidersList(data || []);
        if (data && data.length > 0) setActiveProviderId(data[0].id);
      });
    supabase.from("departments").select("id, name").order("name")
      .then(({ data }) => setDepartmentsList(data || []));
  }, []);

  async function loadReport() {
    if (!filterMonth) { alert("اختاري الشهر الأول"); return; }
    setLoading(true);
    setLoaded(false);

    let query = supabase
      .from("lines")
      .select("number, total_price, provider_id, almanafiz_id, almanafiz(name, groups(name))")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .or("is_deactive.is.null,is_deactive.eq.false")
      .not("almanafiz_id", "is", null);

    if (filterDepartment) query = query.eq("department_id", Number(filterDepartment));

    let allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await query.range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allLines.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // ─── مبالغ السدادات الفعلية لكل رقم خط في الشهر ده ────────
    const paidAmountByLine = new Map<string, number>();
    let pOffset = 0;
    while (true) {
      const { data } = await supabase
        .from("payments")
        .select("line_number, amount")
        .eq("payment_month", filterMonth)
        .range(pOffset, pOffset + 999);
      if (!data || data.length === 0) break;
      data.forEach((p: any) => {
        paidAmountByLine.set(p.line_number, (paidAmountByLine.get(p.line_number) || 0) + (p.amount || 0));
      });
      if (data.length < 1000) break;
      pOffset += 1000;
    }

    const providerSummaryMap = new Map<number, ProviderSummary>();
    const outletsMap = new Map<number, Map<number, OutletRow>>();

    allLines.forEach((line: any) => {
      const providerId = line.provider_id;
      if (!providerId) return;

      if (!providerSummaryMap.has(providerId)) {
        const pName = providersList.find((p) => p.id === providerId)?.name || "—";
        providerSummaryMap.set(providerId, { id: providerId, name: pName, total: 0, paid: 0, unpaid: 0, required: 0, collected: 0 });
      }
      const pSum = providerSummaryMap.get(providerId)!;
      pSum.total++;
      pSum.required += line.total_price || 0;

      const collectedAmount = paidAmountByLine.get(line.number) || 0;
      const isPaid = paidAmountByLine.has(line.number);
      if (isPaid) pSum.paid++; else pSum.unpaid++;
      pSum.collected += collectedAmount;

      if (!outletsMap.has(providerId)) outletsMap.set(providerId, new Map());
      const outMap = outletsMap.get(providerId)!;
      const almanafizId = line.almanafiz_id;
      if (!outMap.has(almanafizId)) {
        outMap.set(almanafizId, {
          almanafiz_id: almanafizId,
          name: line.almanafiz?.name || "—",
          groupName: line.almanafiz?.groups?.name || "—",
          total: 0, paid: 0, unpaid: 0,
        });
      }
      const outRow = outMap.get(almanafizId)!;
      outRow.total++;
      if (isPaid) outRow.paid++; else outRow.unpaid++;
    });

    const summaryArr = [...providerSummaryMap.values()].sort((a, b) => b.total - a.total);
    const outletsObj: Record<number, OutletRow[]> = {};
    outletsMap.forEach((v, k) => {
      outletsObj[k] = [...v.values()].sort((a, b) => b.total - a.total);
    });

    setSummary(summaryArr);
    setOutletsByProvider(outletsObj);
    if (summaryArr.length > 0 && !summaryArr.some((s) => s.id === activeProviderId)) {
      setActiveProviderId(summaryArr[0].id);
    }
    setDetailPage(1);
    setLoaded(true);
    setLoading(false);
  }

  function exportReport() {
    if (!loaded) return;
    const wb = XLSX.utils.book_new();

    const summaryRows = summary.map((s) => ({
      "المنافذ": s.name,
      "إجمالي المنافذ": (outletsByProvider[s.id] || []).length,
      "إجمالي الأرقام": s.total,
      "المسددين": s.paid,
      "الغير مسددين": s.unpaid,
      "نسبة السداد": s.total > 0 ? `${Math.round((s.paid / s.total) * 100)}%` : "0%",
      "إجمالي المستحق": s.required,
      "إجمالي المحصل": s.collected,
    }));
    const totalRequiredCount = summary.reduce((s, x) => s + x.total, 0);
    const totalPaidCount = summary.reduce((s, x) => s + x.paid, 0);
    const totalsRow = {
      "المنافذ": "إجمالي",
      "إجمالي المنافذ": distinctOutletsCount,
      "إجمالي الأرقام": totalRequiredCount,
      "المسددين": totalPaidCount,
      "الغير مسددين": summary.reduce((s, x) => s + x.unpaid, 0),
      "نسبة السداد": totalRequiredCount > 0 ? `${Math.round((totalPaidCount / totalRequiredCount) * 100)}%` : "0%",
      "إجمالي المستحق": summary.reduce((s, x) => s + x.required, 0),
      "إجمالي المحصل": summary.reduce((s, x) => s + x.collected, 0),
    };
    const wsSummary = XLSX.utils.json_to_sheet([...summaryRows, totalsRow]);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");

    summary.forEach((s) => {
      const rows = (outletsByProvider[s.id] || []).map((o, i) => ({
        "N": i + 1,
        "المنفذ": o.name,
        "الجروب": o.groupName,
        "إجمالي الأرقام": o.total,
        "المسددين": o.paid,
        "الغير مسددين": o.unpaid,
        "نسبة المسددين": o.total > 0 ? `${Math.round((o.paid / o.total) * 100)}%` : "0%",
        "نسبة الغير مسددين": o.total > 0 ? `${Math.round((o.unpaid / o.total) * 100)}%` : "0%",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
    });

    XLSX.writeFile(wb, `تقرير_حساب_المنافذ_${filterMonth}.xlsx`);
  }

  // ─── تصدير الصفحة الحالية من الجدول التفصيلي كصورة ────────
  async function exportImage() {
    if (!reportRef.current) return;
    setExportingImage(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#f8fafc",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      const pName = activeProviderId ? providersList.find((p) => p.id === activeProviderId)?.name : "";
      link.download = `تقرير_حساب_المنافذ_${filterMonth}_${pName}_صفحة${detailPage}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      alert("حصل خطأ أثناء تصدير الصورة");
    } finally {
      setExportingImage(false);
    }
  }

  // ─── تصدير كل صفحات الشبكة الحالية — صورة منفصلة لكل صفحة ───
  async function exportAllPagesAsImages() {
    if (!reportRef.current || !activeProviderId) return;
    const total = (outletsByProvider[activeProviderId] || []).length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    setExportingImage(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const pName = providersList.find((p) => p.id === activeProviderId)?.name || "";

      for (let pg = 1; pg <= totalPages; pg++) {
        setDetailPage(pg);
        await new Promise((r) => setTimeout(r, 150));
        const canvas = await html2canvas(reportRef.current!, {
          backgroundColor: "#f8fafc",
          scale: 2,
          useCORS: true,
        });
        const link = document.createElement("a");
        link.download = `تقرير_حساب_المنافذ_${filterMonth}_${pName}_صفحة${pg}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) {
      console.error(err);
      alert("حصل خطأ أثناء تصدير الصور");
    } finally {
      setExportingImage(false);
    }
  }

  if (!authorized) return null;

  const distinctOutletsCount = (() => {
    const ids = new Set<number>();
    Object.values(outletsByProvider).forEach((arr) => arr.forEach((o) => ids.add(o.almanafiz_id)));
    return ids.size;
  })();

  const totalsSummary = {
    outlets: distinctOutletsCount,
    total: summary.reduce((s, x) => s + x.total, 0),
    paid: summary.reduce((s, x) => s + x.paid, 0),
    unpaid: summary.reduce((s, x) => s + x.unpaid, 0),
    required: summary.reduce((s, x) => s + x.required, 0),
    collected: summary.reduce((s, x) => s + x.collected, 0),
  };
  const totalCollectionRate = totalsSummary.total > 0
    ? Math.round((totalsSummary.paid / totalsSummary.total) * 100)
    : 0;

  const allActiveOutlets = activeProviderId ? outletsByProvider[activeProviderId] || [] : [];
  const detailTotalPages = Math.max(1, Math.ceil(allActiveOutlets.length / PAGE_SIZE));
  const activeOutlets = allActiveOutlets.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE);
  const activeProviderName = providersList.find((p) => p.id === activeProviderId)?.name || "";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileBarChart2 className="w-7 h-7 text-indigo-600" />
            </span>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">تقرير حساب المنافذ</h1>
              <p className="text-base text-slate-500 mt-1">ملخص وتفصيل السداد لكل منفذ حسب الشبكة والشهر</p>
            </div>
          </div>
          {loaded && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={exportImage} disabled={exportingImage}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-60">
                {exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
                تصدير الصفحة الحالية كصورة
              </button>
              {detailTotalPages > 1 && (
                <button onClick={exportAllPagesAsImages} disabled={exportingImage}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-60">
                  {exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
                  تصدير كل الصفحات ({detailTotalPages} صورة)
                </button>
              )}
              <button onClick={exportReport}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Download className="w-4 h-4" /> تصدير Excel
              </button>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-slate-500 mb-1.5">
                <Calendar className="w-4 h-4" /> الشهر
              </label>
              <input type="month" value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-slate-500 mb-1.5">
                <Building2 className="w-4 h-4" /> القسم
              </label>
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-[180px]">
                <option value="">كل الأقسام</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <button onClick={loadReport} disabled={loading || !filterMonth}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-base transition">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart2 className="w-4 h-4" />}
              عرض التقرير
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل البيانات...
          </div>
        )}

        {!loading && loaded && (
          <div ref={reportRef} className="bg-slate-50">
            {/* Summary Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
              <div className="p-4 border-b border-slate-100 bg-indigo-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-indigo-700">ملخص حساب المنافذ — {filterMonth}</h2>
                {filterDepartment && (
                  <span className="text-sm bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                    {departmentsList.find((d) => String(d.id) === filterDepartment)?.name}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-slate-50 text-slate-700 text-sm">
                  <tr>
                    <th className="p-3 text-right font-medium">المنافذ</th>
                    <th className="p-3 text-right font-medium">إجمالي المنافذ</th>
                    <th className="p-3 text-right font-medium">إجمالي الأرقام</th>
                    <th className="p-3 text-right font-medium">المسددين</th>
                    <th className="p-3 text-right font-medium">الغير مسددين</th>
                    <th className="p-3 text-right font-medium">نسبة السداد</th>
                
                    <th className="p-3 text-right font-medium">إجمالي المحصل</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {summary.map((s) => {
                    const rate = s.total > 0 ? Math.round((s.paid / s.total) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                        <td className="p-3 font-bold text-slate-900">{s.name}</td>
                        <td className="p-3">{(outletsByProvider[s.id] || []).length}</td>
                        <td className="p-3 font-medium">{s.total.toLocaleString()}</td>
                        <td className="p-3 text-green-600 font-medium">{s.paid.toLocaleString()}</td>
                        <td className="p-3 text-red-500 font-medium">{s.unpaid.toLocaleString()}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-blue-50 text-blue-700">
                            {rate}%
                          </span>
                        </td>
                        <td className="p-3 font-bold text-purple-700">{s.collected.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {summary.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400">لا توجد بيانات لهذا الفلتر</td>
                    </tr>
                  )}
                  {summary.length > 0 && (
                    <tr className="border-t-2 border-indigo-100 bg-indigo-50/40 font-bold">
                      <td className="p-3 text-indigo-700">إجمالي</td>
                      <td className="p-3">{totalsSummary.outlets}</td>
                      <td className="p-3">{totalsSummary.total.toLocaleString()}</td>
                      <td className="p-3 text-green-700">{totalsSummary.paid.toLocaleString()}</td>
                      <td className="p-3 text-red-600">{totalsSummary.unpaid.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                          {totalCollectionRate}%
                        </span>
                      </td>
                      <td className="p-3 text-purple-700">{totalsSummary.collected.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {summary.length > 0 && (
              <>
                {/* Provider Tabs */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm mb-4 w-fit">
                  {summary.map((s) => (
                    <button key={s.id} onClick={() => { setActiveProviderId(s.id); setDetailPage(1); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-base font-medium transition ${
                        activeProviderId === s.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                      }`}>
                      <Network className="w-4 h-4" /> {s.name}
                    </button>
                  ))}
                </div>

                {/* Detail Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
                  <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-emerald-700">
                      حساب المنفذ لشهر {filterMonth} ({activeProviderName})
                    </h2>
                    <span className="text-sm text-slate-500">
                      {allActiveOutlets.length.toLocaleString()} منفذ — صفحة {detailPage} من {detailTotalPages}
                    </span>
                  </div>
                  <table className="w-full text-base">
                    <thead className="bg-slate-50 text-slate-700 text-sm">
                      <tr>
                        <th className="p-3 text-right font-medium">N</th>
                        <th className="p-3 text-right font-medium">المنافذ</th>
                        <th className="p-3 text-right font-medium">الجروب</th>
                        <th className="p-3 text-right font-medium">إجمالي الأرقام</th>
                        <th className="p-3 text-right font-medium">المسددين</th>
                        <th className="p-3 text-right font-medium">الغير مسددين</th>
                        <th className="p-3 text-right font-medium">نسبة المسددين</th>
                        <th className="p-3 text-right font-medium">نسبة الغير مسددين</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {activeOutlets.map((o, i) => {
                        const paidPct = o.total > 0 ? Math.round((o.paid / o.total) * 100) : 0;
                        const unpaidPct = o.total > 0 ? Math.round((o.unpaid / o.total) * 100) : 0;
                        return (
                          <tr key={o.almanafiz_id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                            <td className="p-3 text-slate-400">{(detailPage - 1) * PAGE_SIZE + i + 1}</td>
                            <td className="p-3 font-medium text-slate-900">{o.name}</td>
                            <td className="p-3 text-slate-500">{o.groupName}</td>
                            <td className="p-3">{o.total.toLocaleString()}</td>
                            <td className="p-3 text-green-600">{o.paid.toLocaleString()}</td>
                            <td className="p-3 text-red-500">{o.unpaid.toLocaleString()}</td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-green-50 text-green-700">
                                {paidPct}%
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-red-50 text-red-600">
                                {unpaidPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {activeOutlets.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-slate-400">لا توجد بيانات لهذه الشبكة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {detailTotalPages > 1 && (
                    <div className="flex justify-between items-center p-4 border-t border-slate-100" dir="ltr">
                      <span className="text-sm text-slate-400">{allActiveOutlets.length.toLocaleString()} منفذ</span>
                      <div className="flex items-center gap-2">
                        <button disabled={detailPage === 1} onClick={() => setDetailPage((p) => p - 1)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 text-base font-medium">
                          <ChevronLeft className="w-4 h-4" /> السابق
                        </button>
                        <span className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-base">{detailPage}</span>
                        <button disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage((p) => p + 1)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40 text-base font-medium">
                          التالي <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !loaded && (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400 text-lg">
            اختاري الشهر واضغطي "عرض التقرير"
          </div>
        )}
      </div>
    </div>
  );
}