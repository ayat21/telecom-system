"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Wallet, Loader2, Calendar, Download, FileBarChart2,
} from "lucide-react";

interface NetworkStat {
  total: number;
  paid: number;
  unpaid: number;
}

interface DeptRow {
  id: number;
  name: string;
  networks: Record<"etisalat" | "orange" | "vodafone", NetworkStat>;
  totalPaidLines: number;
  invoiceDuePaid: number;
  collectedPaid: number;
  netProfit: number;
  totalUnpaidLines: number;
  invoiceDueUnpaid: number;
  netLossUnpaid: number;
  totalLines: number;
}

function classifyProvider(name: string): "etisalat" | "orange" | "vodafone" | "other" {
  const n = (name || "").toLowerCase();
  if (n.includes("etisalat") || n.includes("اتصالات")) return "etisalat";
  if (n.includes("orange") || n.includes("اورنج") || n.includes("أورنج")) return "orange";
  if (n.includes("vodafone") || n.includes("فودافون")) return "vodafone";
  return "other";
}

function emptyNet(): NetworkStat {
  return { total: 0, paid: 0, unpaid: 0 };
}

export default function MonthlyBudgetPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [rows, setRows] = useState<DeptRow[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  async function loadReport() {
    if (!filterMonth) { alert("اختاري الشهر الأول"); return; }
    setLoading(true);
    setLoaded(false);

    // ─── الأقسام ─────────────────────────────────────────────
    const { data: departments } = await supabase.from("departments").select("id, name");
    const deptMap = new Map<number, DeptRow>();
    (departments || []).forEach((d: any) => {
      deptMap.set(d.id, {
        id: d.id, name: d.name,
        networks: { etisalat: emptyNet(), orange: emptyNet(), vodafone: emptyNet() },
        totalPaidLines: 0, invoiceDuePaid: 0, collectedPaid: 0, netProfit: 0,
        totalUnpaidLines: 0, invoiceDueUnpaid: 0, netLossUnpaid: 0, totalLines: 0,
      });
    });

    // ─── كل الخطوط النشطة المرتبطة بقسم ───────────────────────
    let allLines: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("lines")
        .select("number, total_price, department_id, providers(name)")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .not("department_id", "is", null)
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allLines.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // ─── السدادات للشهر المختار ────────────────────────────────
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

    // ─── التجميع ─────────────────────────────────────────────
    allLines.forEach((line: any) => {
      const dept = deptMap.get(line.department_id);
      if (!dept) return;

      dept.totalLines++;
      const isPaid = paidAmountByLine.has(line.number);
      const category = classifyProvider(line.providers?.name || "");

      if (category !== "other") {
        const net = dept.networks[category];
        net.total++;
        if (isPaid) net.paid++; else net.unpaid++;
      }

      if (isPaid) {
        dept.totalPaidLines++;
        dept.invoiceDuePaid += line.total_price || 0;
        dept.collectedPaid += paidAmountByLine.get(line.number) || 0;
      } else {
        dept.totalUnpaidLines++;
        dept.invoiceDueUnpaid += line.total_price || 0;
      }
    });

    const finalRows = [...deptMap.values()].map((d) => ({
      ...d,
      netProfit: d.collectedPaid - d.invoiceDuePaid,
      netLossUnpaid: -d.invoiceDueUnpaid,
    })).sort((a, b) => b.totalLines - a.totalLines);

    setRows(finalRows);
    setLoaded(true);
    setLoading(false);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const rowsOut = rows.map((d) => ({
      "القسم": d.name,
      "Total اتصالات": d.networks.etisalat.total,
      "الغير مسددين اتصالات": d.networks.etisalat.unpaid,
      "المسددين اتصالات": d.networks.etisalat.paid,
      "Total أورنج": d.networks.orange.total,
      "الغير مسددين أورنج": d.networks.orange.unpaid,
      "المسددين أورنج": d.networks.orange.paid,
      "Total فودافون": d.networks.vodafone.total,
      "الغير مسددين فودافون": d.networks.vodafone.unpaid,
      "المسددين فودافون": d.networks.vodafone.paid,
      "إجمالي المسددين": d.totalPaidLines,
      "فاتورة مستحقة (مسدد)": d.invoiceDuePaid,
      "المحصل": d.collectedPaid,
      "صافي الربح": d.netProfit,
      "إجمالي الغير مسددين": d.totalUnpaidLines,
      "فاتورة مستحقة (غير مسدد)": d.invoiceDueUnpaid,
      "صافي الربح/الخسارة": d.netLossUnpaid,
    }));

    const totalsRow = {
      "القسم": "الإجمالي",
      "Total اتصالات": rows.reduce((s, d) => s + d.networks.etisalat.total, 0),
      "الغير مسددين اتصالات": rows.reduce((s, d) => s + d.networks.etisalat.unpaid, 0),
      "المسددين اتصالات": rows.reduce((s, d) => s + d.networks.etisalat.paid, 0),
      "Total أورنج": rows.reduce((s, d) => s + d.networks.orange.total, 0),
      "الغير مسددين أورنج": rows.reduce((s, d) => s + d.networks.orange.unpaid, 0),
      "المسددين أورنج": rows.reduce((s, d) => s + d.networks.orange.paid, 0),
      "Total فودافون": rows.reduce((s, d) => s + d.networks.vodafone.total, 0),
      "الغير مسددين فودافون": rows.reduce((s, d) => s + d.networks.vodafone.unpaid, 0),
      "المسددين فودافون": rows.reduce((s, d) => s + d.networks.vodafone.paid, 0),
      "إجمالي المسددين": rows.reduce((s, d) => s + d.totalPaidLines, 0),
      "فاتورة مستحقة (مسدد)": rows.reduce((s, d) => s + d.invoiceDuePaid, 0),
      "المحصل": rows.reduce((s, d) => s + d.collectedPaid, 0),
      "صافي الربح": rows.reduce((s, d) => s + d.netProfit, 0),
      "إجمالي الغير مسددين": rows.reduce((s, d) => s + d.totalUnpaidLines, 0),
      "فاتورة مستحقة (غير مسدد)": rows.reduce((s, d) => s + d.invoiceDueUnpaid, 0),
      "صافي الربح/الخسارة": rows.reduce((s, d) => s + d.netLossUnpaid, 0),
    };

    const ws = XLSX.utils.json_to_sheet([...rowsOut, totalsRow]);
    const wb2 = wb;
    XLSX.utils.book_append_sheet(wb2, ws, "الميزانية");
    XLSX.writeFile(wb2, `ميزانية_${filterMonth}.xlsx`);
  }

  if (!authorized) return null;

  const totals = {
    etisalat: rows.reduce((acc, d) => ({
      total: acc.total + d.networks.etisalat.total,
      paid: acc.paid + d.networks.etisalat.paid,
      unpaid: acc.unpaid + d.networks.etisalat.unpaid,
    }), emptyNet()),
    orange: rows.reduce((acc, d) => ({
      total: acc.total + d.networks.orange.total,
      paid: acc.paid + d.networks.orange.paid,
      unpaid: acc.unpaid + d.networks.orange.unpaid,
    }), emptyNet()),
    vodafone: rows.reduce((acc, d) => ({
      total: acc.total + d.networks.vodafone.total,
      paid: acc.paid + d.networks.vodafone.paid,
      unpaid: acc.unpaid + d.networks.vodafone.unpaid,
    }), emptyNet()),
    totalPaidLines: rows.reduce((s, d) => s + d.totalPaidLines, 0),
    invoiceDuePaid: rows.reduce((s, d) => s + d.invoiceDuePaid, 0),
    collectedPaid: rows.reduce((s, d) => s + d.collectedPaid, 0),
    netProfit: rows.reduce((s, d) => s + d.netProfit, 0),
    totalUnpaidLines: rows.reduce((s, d) => s + d.totalUnpaidLines, 0),
    invoiceDueUnpaid: rows.reduce((s, d) => s + d.invoiceDueUnpaid, 0),
    netLossUnpaid: rows.reduce((s, d) => s + d.netLossUnpaid, 0),
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-[1500px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-indigo-600" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">بيان حسابات اتصالات تيليكوم</h1>
              <p className="text-sm text-slate-500 mt-0.5">ميزانية شهرية شاملة لكل قسم وكل شبكة</p>
            </div>
          </div>
          {loaded && (
            <button onClick={exportExcel}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
              <Download className="w-4 h-4" /> تصدير Excel
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Calendar className="w-3.5 h-3.5" /> الشهر
              </label>
              <input type="month" value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <button onClick={loadReport} disabled={loading || !filterMonth}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart2 className="w-4 h-4" />}
              عرض الميزانية
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل البيانات...
          </div>
        )}

        {!loading && loaded && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-white text-xs">
                  <th rowSpan={2} className="p-2 bg-slate-600 sticky right-0 z-10 min-w-[130px]">القسم</th>
                  <th colSpan={3} className="p-2 bg-green-600">Etisalat</th>
                  <th colSpan={3} className="p-2 bg-orange-500">Orange</th>
                  <th colSpan={3} className="p-2 bg-red-500">Vodafone</th>
                  <th colSpan={4} className="p-2 bg-blue-600">بيان المسددين</th>
                  <th colSpan={3} className="p-2 bg-slate-500">بيان الغير مسددين</th>
                </tr>
                <tr className="text-white text-[11px]">
                  <th className="p-1.5 bg-green-500">المسددين</th>
                  <th className="p-1.5 bg-green-500">الغير مسددين</th>
                  <th className="p-1.5 bg-green-500">Total</th>
                  <th className="p-1.5 bg-orange-400">المسددين</th>
                  <th className="p-1.5 bg-orange-400">الغير مسددين</th>
                  <th className="p-1.5 bg-orange-400">Total</th>
                  <th className="p-1.5 bg-red-400">المسددين</th>
                  <th className="p-1.5 bg-red-400">الغير مسددين</th>
                  <th className="p-1.5 bg-red-400">Total</th>
                  <th className="p-1.5 bg-blue-500">إجمالي المسددين</th>
                  <th className="p-1.5 bg-blue-500">فاتورة مستحقة</th>
                  <th className="p-1.5 bg-blue-500">المحصل</th>
                  <th className="p-1.5 bg-blue-500">صافي الربح</th>
                  <th className="p-1.5 bg-slate-400">إجمالي الغير مسددين</th>
                  <th className="p-1.5 bg-slate-400">فاتورة مستحقة</th>
                  <th className="p-1.5 bg-slate-400">صافي الربح/الخسارة</th>
                </tr>
              </thead>
              <tbody className="text-center text-slate-700">
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-2 font-bold text-slate-900 text-right sticky right-0 bg-white z-10">{d.name}</td>

                    <td className="p-2 bg-green-50/40">{d.networks.etisalat.paid.toLocaleString()}</td>
                    <td className="p-2 bg-green-50/40 text-red-500">{d.networks.etisalat.unpaid.toLocaleString()}</td>
                    <td className="p-2 bg-green-50/40 font-medium">{d.networks.etisalat.total.toLocaleString()}</td>

                    <td className="p-2 bg-orange-50/40">{d.networks.orange.paid.toLocaleString()}</td>
                    <td className="p-2 bg-orange-50/40 text-red-500">{d.networks.orange.unpaid.toLocaleString()}</td>
                    <td className="p-2 bg-orange-50/40 font-medium">{d.networks.orange.total.toLocaleString()}</td>

                    <td className="p-2 bg-red-50/40">{d.networks.vodafone.paid.toLocaleString()}</td>
                    <td className="p-2 bg-red-50/40 text-red-500">{d.networks.vodafone.unpaid.toLocaleString()}</td>
                    <td className="p-2 bg-red-50/40 font-medium">{d.networks.vodafone.total.toLocaleString()}</td>

                    <td className="p-2 bg-blue-50/40 font-bold">{d.totalPaidLines.toLocaleString()}</td>
                    <td className="p-2 bg-blue-50/40">{d.invoiceDuePaid.toLocaleString()}</td>
                    <td className="p-2 bg-blue-50/40 text-green-600 font-medium">{d.collectedPaid.toLocaleString()}</td>
                    <td className={`p-2 bg-blue-50/40 font-bold ${d.netProfit < 0 ? "text-red-500" : "text-green-600"}`}>
                      {d.netProfit.toLocaleString()}
                    </td>

                    <td className="p-2 bg-slate-50 font-bold">{d.totalUnpaidLines.toLocaleString()}</td>
                    <td className="p-2 bg-slate-50">{d.invoiceDueUnpaid.toLocaleString()}</td>
                    <td className="p-2 bg-slate-50 text-red-500 font-medium">{d.netLossUnpaid.toLocaleString()}</td>
                  </tr>
                ))}

                {/* صف الإجمالي */}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <td className="p-2 text-right sticky right-0 bg-slate-100 z-10">الإجمالي</td>
                  <td className="p-2">{totals.etisalat.paid.toLocaleString()}</td>
                  <td className="p-2 text-red-500">{totals.etisalat.unpaid.toLocaleString()}</td>
                  <td className="p-2">{totals.etisalat.total.toLocaleString()}</td>
                  <td className="p-2">{totals.orange.paid.toLocaleString()}</td>
                  <td className="p-2 text-red-500">{totals.orange.unpaid.toLocaleString()}</td>
                  <td className="p-2">{totals.orange.total.toLocaleString()}</td>
                  <td className="p-2">{totals.vodafone.paid.toLocaleString()}</td>
                  <td className="p-2 text-red-500">{totals.vodafone.unpaid.toLocaleString()}</td>
                  <td className="p-2">{totals.vodafone.total.toLocaleString()}</td>
                  <td className="p-2">{totals.totalPaidLines.toLocaleString()}</td>
                  <td className="p-2">{totals.invoiceDuePaid.toLocaleString()}</td>
                  <td className="p-2 text-green-600">{totals.collectedPaid.toLocaleString()}</td>
                  <td className={`p-2 ${totals.netProfit < 0 ? "text-red-500" : "text-green-600"}`}>
                    {totals.netProfit.toLocaleString()}
                  </td>
                  <td className="p-2">{totals.totalUnpaidLines.toLocaleString()}</td>
                  <td className="p-2">{totals.invoiceDueUnpaid.toLocaleString()}</td>
                  <td className="p-2 text-red-500">{totals.netLossUnpaid.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loaded && (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
            اختاري الشهر واضغطي "عرض الميزانية"
          </div>
        )}
      </div>
    </div>
  );
}