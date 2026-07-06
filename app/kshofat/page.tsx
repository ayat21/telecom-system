"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileText, Filter, Calendar, Network, Loader2,
  Download, FileSpreadsheet, X,
} from "lucide-react";

interface LineRow {
  id: number;
  number: string;
  client_name: string;
  report_note: string;
  total_price: number;
}

export default function KashfPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [almanafizSearch, setAlmanafizSearch] = useState("");
  const [showAlmanafizDropdown, setShowAlmanafizDropdown] = useState(false);
  const almanafizRef = useRef<HTMLDivElement>(null);

  const [filterAlmanafiz, setFilterAlmanafiz] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const selectedAlmanafiz = almanafizList.find((a) => String(a.id) === filterAlmanafiz);
  const totalLines = lines.length;
  const totalAmount = lines.reduce((s, l) => s + (l.total_price || 0), 0);

  const filteredAlmanafiz = almanafizSearch.trim()
    ? almanafizList.filter((a) => a.name.includes(almanafizSearch))
    : almanafizList;

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    supabase
      .from("almanafiz")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAlmanafizList(data || []));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (almanafizRef.current && !almanafizRef.current.contains(e.target as Node))
        setShowAlmanafizDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadData() {
    if (!filterAlmanafiz) { alert("اختاري المنفذ أو الهيئة"); return; }
    if (!filterMonth) { alert("اختاري الشهر"); return; }

    setLoading(true);
    setSearched(true);

    const [year, month] = filterMonth.split("-");
    const fromDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const toDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("lines")
      .select(`id, number, total_price, report_note, clients(name)`)
      .eq("almanafiz_id", Number(filterAlmanafiz))
      .gte("customer_date_real", fromDate)
      .lte("customer_date_real", toDate)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("id", { ascending: true });

    setLoading(false);
    if (error) { alert(error.message); return; }

    setLines(
      (data || []).map((l: any) => ({
        id: l.id,
        number: l.number,
        client_name: l.clients?.name || "—",
        report_note: l.report_note || "—",
        total_price: l.total_price || 0,
      }))
    );
  }

  // ─── PDF ──────────────────────────────────────────────────
  function printPDF() {
    const [year, month] = filterMonth.split("-");
    const monthNames = [
      "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];
    const monthName = monthNames[Number(month) - 1];

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>كشف حساب - ${selectedAlmanafiz?.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 30px; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e40af; padding-bottom: 16px; }
          .header h1 { font-size: 22px; color: #1e40af; margin-bottom: 6px; font-weight: bold; }
          .header p { font-size: 14px; color: #64748b; }
          .summary { display: flex; gap: 16px; margin-bottom: 20px; }
          .summary-card { flex: 1; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
          .summary-card .label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
          .summary-card .value { font-size: 22px; font-weight: bold; color: #1e40af; }
          .summary-card .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e40af; color: white; padding: 10px 8px; text-align: right; font-size: 12px; font-weight: bold; }
          td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          tr:nth-child(even) td { background: #f8fafc; }
          tfoot td { background: #eff6ff; color: #1e40af; font-weight: bold; border-top: 2px solid #1e40af; }
          .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>كشف حساب ${selectedAlmanafiz?.name || ""}</h1>
          <p>عن شهر ${monthName} ${year}</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <div class="label">إجمالي الخطوط</div>
            <div class="value">${totalLines}</div>
            <div class="sub">خط</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي المبلغ</div>
            <div class="value">${totalAmount.toLocaleString()}</div>
            <div class="sub">جنيه</div>
          </div>
          <div class="summary-card">
            <div class="label">متوسط الفاتورة</div>
            <div class="value">${totalLines > 0 ? Math.round(totalAmount / totalLines).toLocaleString() : 0}</div>
            <div class="sub">جنيه</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px">#</th>
              <th>رقم الخط</th>
              <th>اسم العميل</th>
              <th>ملاحظات التقرير</th>
              <th style="width:120px">إجمالي الفاتورة</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map((line, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${line.number}</td>
                <td>${line.client_name}</td>
                <td>${line.report_note}</td>
                <td>${line.total_price.toLocaleString()} جنيه</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">الإجمالي</td>
              <td>${totalLines} خط</td>
              <td></td>
              <td>${totalAmount.toLocaleString()} جنيه</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          تم إنشاء هذا الكشف بتاريخ ${new Date().toLocaleDateString("ar-EG")}
        </div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  // ─── Excel ────────────────────────────────────────────────
  function exportExcel() {
    const [year, month] = filterMonth.split("-");
    const data = [
      ...lines.map((line, i) => ({
        "#": i + 1,
        "رقم الخط": line.number,
        "اسم العميل": line.client_name,
        "ملاحظات التقرير": line.report_note,
        "إجمالي الفاتورة": line.total_price,
      })),
      {
        "#": "",
        "رقم الخط": "",
        "اسم العميل": "الإجمالي",
        "ملاحظات التقرير": `${totalLines} خط`,
        "إجمالي الفاتورة": totalAmount,
      } as any,
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف حساب");
    XLSX.writeFile(wb, `كشف-${selectedAlmanafiz?.name}-${year}-${month}.xlsx`);
  }

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">كشوفات المنافذ والهيئات</h1>
            <p className="text-sm text-slate-500 mt-0.5">استعراض وطباعة كشف حساب لكل منفذ أو هيئة</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <div className="grid md:grid-cols-3 gap-4">

            {/* المنفذ — searchable */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">المنفذ / الهيئة</label>
              <div ref={almanafizRef} className="relative">
                {filterAlmanafiz ? (
                  <div className="flex items-center justify-between border border-blue-300 bg-blue-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-800">{selectedAlmanafiz?.name}</span>
                    </div>
                    <button onClick={() => { setFilterAlmanafiz(""); setAlmanafizSearch(""); }}
                      className="text-blue-400 hover:text-blue-600 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Network className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        value={almanafizSearch}
                        onChange={(e) => { setAlmanafizSearch(e.target.value); setShowAlmanafizDropdown(true); }}
                        onFocus={() => setShowAlmanafizDropdown(true)}
                        placeholder="ابحث عن منفذ أو هيئة..."
                        className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                      />
                    </div>
                    {showAlmanafizDropdown && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
                        {filteredAlmanafiz.length > 0 ? (
                          filteredAlmanafiz.map((a) => (
                            <button key={a.id} type="button"
                              onClick={() => {
                                setFilterAlmanafiz(String(a.id));
                                setAlmanafizSearch("");
                                setShowAlmanafizDropdown(false);
                              }}
                              className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 transition border-b border-slate-50 last:border-0">
                              {a.name}
                            </button>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-slate-400">مش لاقي نتايج</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* الشهر */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">الشهر</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="month" value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
              </div>
            </div>

            {/* زرار */}
            <div className="flex items-end">
              <button onClick={loadData} disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-medium text-sm transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
                عرض الكشف
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {searched && !loading && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-xs text-slate-400 mb-1">إجمالي الخطوط</p>
                <p className="text-3xl font-bold text-blue-600">{totalLines}</p>
                <p className="text-xs text-slate-400 mt-1">خط</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-xs text-slate-400 mb-1">إجمالي المبلغ</p>
                <p className="text-3xl font-bold text-green-600">{totalAmount.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">جنيه</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
                <p className="text-xs text-slate-400 mb-1">متوسط الفاتورة</p>
                <p className="text-3xl font-bold text-slate-700">
                  {totalLines > 0 ? Math.round(totalAmount / totalLines).toLocaleString() : 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">جنيه</p>
              </div>
            </div>

            {/* Action buttons */}
            {lines.length > 0 && (
              <div className="flex gap-3 mb-4">
                <button onClick={printPDF}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
                  <FileText className="w-4 h-4" /> طباعة PDF
                </button>
                <button onClick={exportExcel}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
                  <FileSpreadsheet className="w-4 h-4" /> تحميل Excel
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
              <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50">
                <h2 className="text-base font-bold text-blue-800">
                  كشف حساب: {selectedAlmanafiz?.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filterMonth.split("-")[1]} / {filterMonth.split("-")[0]}
                </p>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="p-3 text-right font-medium w-10">#</th>
                    <th className="p-3 text-right font-medium">رقم الخط</th>
                    <th className="p-3 text-right font-medium">اسم العميل</th>
                    <th className="p-3 text-right font-medium">ملاحظات التقرير</th>
                    <th className="p-3 text-right font-medium">إجمالي الفاتورة</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {lines.map((line, i) => (
                    <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                      <td className="p-3 text-slate-400">{i + 1}</td>
                      <td className="p-3 font-mono font-medium text-slate-900">{line.number}</td>
                      <td className="p-3">{line.client_name}</td>
                      <td className="p-3 text-slate-500">{line.report_note}</td>
                      <td className="p-3 font-semibold text-slate-900">
                        {line.total_price.toLocaleString()} جنيه
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400">
                        لا توجد خطوط في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 font-bold text-blue-800 border-t-2 border-blue-200">
                      <td className="p-3" colSpan={2}>الإجمالي</td>
                      <td className="p-3">{totalLines} خط</td>
                      <td className="p-3"></td>
                      <td className="p-3">{totalAmount.toLocaleString()} جنيه</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}