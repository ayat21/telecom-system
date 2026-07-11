"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FileText, Filter, Calendar, Network, Loader2,
  Download, FileSpreadsheet, X, LayoutGrid,
} from "lucide-react";

interface LineRow {
  id: number;
  number: string;
  client_name: string;
  report_note: string;
  total_price: number;
  almanafiz_id?: number;
  almanafiz_name?: string;
}

export default function KashfPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [almanafizSearch, setAlmanafizSearch] = useState("");
  const [showAlmanafizDropdown, setShowAlmanafizDropdown] = useState(false);
  const almanafizRef = useRef<HTMLDivElement>(null);
  const [filterAlmanafiz, setFilterAlmanafiz] = useState("");

  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [filterGroup, setFilterGroup] = useState("");

  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");

  const pdfCaptureRef = useRef<HTMLDivElement>(null);

  const isGroupMode = Boolean(filterGroup);
  const selectedAlmanafiz = almanafizList.find((a) => String(a.id) === filterAlmanafiz);
  const selectedGroup = groupsList.find((g) => String(g.id) === filterGroup);

  const totalLines = lines.length;
  const totalAmount = lines.reduce((s, l) => s + (l.total_price || 0), 0);

  const filteredAlmanafiz = almanafizSearch.trim()
    ? almanafizList.filter((a) => a.name.includes(almanafizSearch))
    : almanafizList;

  const reportTitle = isGroupMode
    ? `${selectedGroup?.name || ""} (كل المنافذ التابعة)`
    : selectedAlmanafiz?.name || "";

  const linesByOutlet = (() => {
    const map = new Map<number, { name: string; lines: LineRow[] }>();
    lines.forEach((l) => {
      const key = l.almanafiz_id ?? -1;
      if (!map.has(key)) map.set(key, { name: l.almanafiz_name || "—", lines: [] });
      map.get(key)!.lines.push(l);
    });
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  })();

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    supabase.from("almanafiz").select("id, name").order("name")
      .then(({ data }) => setAlmanafizList(data || []));
    supabase.from("groups").select("id, name").order("name")
      .then(({ data }) => setGroupsList(data || []));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (almanafizRef.current && !almanafizRef.current.contains(e.target as Node))
        setShowAlmanafizDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pickAlmanafiz(id: string) {
    setFilterAlmanafiz(id);
    setFilterGroup("");
    setAlmanafizSearch("");
    setShowAlmanafizDropdown(false);
  }

  function pickGroup(id: string) {
    setFilterGroup(id);
    setFilterAlmanafiz("");
    setAlmanafizSearch("");
  }

  async function loadData() {
    if (!filterAlmanafiz && !filterGroup) { alert("اختاري المنفذ أو الجروب"); return; }

    setLoading(true);
    setSearched(true);

    let query = supabase
      .from("lines")
      .select(`id, number, total_price, report_note, clients(name), almanafiz!inner(id, name, group_id)`)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .or("is_deactive.is.null,is_deactive.eq.false")
      .order("id", { ascending: true });

    if (filterGroup) {
      query = query.eq("almanafiz.group_id", Number(filterGroup));
    } else {
      query = query.eq("almanafiz_id", Number(filterAlmanafiz));
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) { alert(error.message); return; }

    setLines(
      (data || []).map((l: any) => ({
        id: l.id,
        number: l.number,
        client_name: l.clients?.name || "—",
        report_note: l.report_note || "—",
        total_price: l.total_price || 0,
        almanafiz_id: l.almanafiz?.id,
        almanafiz_name: l.almanafiz?.name || "—",
      }))
    );
  }

  function buildStatementHtml(title: string, rows: LineRow[], monthName: string, year: string) {
    const total = rows.reduce((s, l) => s + (l.total_price || 0), 0);
    return `
      <div style="font-family: Arial, sans-serif; direction: rtl; color: #1e293b; background: #ffffff; padding: 30px; width: 780px;">
        <div style="text-align:center; margin-bottom:24px; border-bottom:2px solid #1e40af; padding-bottom:16px;">
          <h1 style="font-size:22px; color:#1e40af; margin-bottom:6px; font-weight:bold;">كشف حساب ${title}</h1>
          <p style="font-size:14px; color:#64748b;">عن شهر ${monthName} ${year}</p>
        </div>
        <div style="display:flex; gap:16px; margin-bottom:20px;">
          <div style="flex:1; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; margin-bottom:6px;">إجمالي الخطوط</div>
            <div style="font-size:22px; font-weight:bold; color:#1e40af;">${rows.length}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">خط</div>
          </div>
          <div style="flex:1; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; margin-bottom:6px;">إجمالي المبلغ</div>
            <div style="font-size:22px; font-weight:bold; color:#1e40af;">${total.toLocaleString()}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">جنيه</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="width:40px; background:#1e40af; color:white; padding:10px 8px; text-align:right; font-size:12px;">#</th>
              <th style="background:#1e40af; color:white; padding:10px 8px; text-align:right; font-size:12px;">رقم الخط</th>
              <th style="background:#1e40af; color:white; padding:10px 8px; text-align:right; font-size:12px;">اسم العميل</th>
              <th style="background:#1e40af; color:white; padding:10px 8px; text-align:right; font-size:12px;">ملاحظات التقرير</th>
              <th style="width:120px; background:#1e40af; color:white; padding:10px 8px; text-align:right; font-size:12px;">إجمالي الفاتورة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((line, i) => `
              <tr>
                <td style="padding:9px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; ${i % 2 === 1 ? "background:#f8fafc;" : ""}">${i + 1}</td>
                <td style="padding:9px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; ${i % 2 === 1 ? "background:#f8fafc;" : ""}">${line.number}</td>
                <td style="padding:9px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; ${i % 2 === 1 ? "background:#f8fafc;" : ""}">${line.client_name}</td>
                <td style="padding:9px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; ${i % 2 === 1 ? "background:#f8fafc;" : ""}">${line.report_note}</td>
                <td style="padding:9px 8px; border-bottom:1px solid #e2e8f0; font-size:12px; ${i % 2 === 1 ? "background:#f8fafc;" : ""}">${line.total_price.toLocaleString()} جنيه</td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="background:#eff6ff; color:#1e40af; font-weight:bold; border-top:2px solid #1e40af; padding:9px 8px; font-size:12px;">الإجمالي</td>
              <td style="background:#eff6ff; color:#1e40af; font-weight:bold; border-top:2px solid #1e40af; padding:9px 8px; font-size:12px;">${rows.length} خط</td>
              <td style="background:#eff6ff; border-top:2px solid #1e40af; padding:9px 8px;"></td>
              <td style="background:#eff6ff; color:#1e40af; font-weight:bold; border-top:2px solid #1e40af; padding:9px 8px; font-size:12px;">${total.toLocaleString()} جنيه</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:24px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px;">
          تم إنشاء هذا الكشف بتاريخ ${new Date().toLocaleDateString("ar-EG")}
        </div>
      </div>
    `;
  }

  async function downloadSinglePdf(title: string, rows: LineRow[], monthName: string, year: string) {
    if (!pdfCaptureRef.current) return;

    pdfCaptureRef.current.innerHTML = buildStatementHtml(title, rows, monthName, year);
    await new Promise((r) => setTimeout(r, 100));

    const html2canvas = (await import("html2canvas-pro")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(pdfCaptureRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-");
    pdf.save(`كشف-${safeTitle}-${year}-${monthName}.pdf`);
    pdfCaptureRef.current.innerHTML = "";
  }

  async function downloadAllPdfs() {
    const [year, month] = filterMonth.split("-");
    const monthNames = [
      "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];
    const monthName = monthNames[Number(month) - 1];

    setGeneratingPdf(true);
    try {
      if (isGroupMode) {
        for (let i = 0; i < linesByOutlet.length; i++) {
          const outlet = linesByOutlet[i];
          setPdfProgress(`جارٍ إنشاء كشف ${i + 1} من ${linesByOutlet.length} (${outlet.name})...`);
          await downloadSinglePdf(outlet.name, outlet.lines, monthName, year);
          await new Promise((r) => setTimeout(r, 600));
        }
      } else {
        setPdfProgress(`جارٍ إنشاء الكشف...`);
        await downloadSinglePdf(reportTitle, lines, monthName, year);
      }
    } catch (err) {
      console.error(err);
      alert("حصل خطأ أثناء إنشاء ملفات PDF");
    } finally {
      setGeneratingPdf(false);
      setPdfProgress("");
    }
  }

  function exportExcel() {
    const [year, month] = filterMonth.split("-");
    const wb = XLSX.utils.book_new();

    function buildSheetRows(rows: LineRow[]) {
      const total = rows.reduce((s, l) => s + l.total_price, 0);
      return [
        ...rows.map((line, i) => ({
          "#": i + 1,
          "رقم الخط": line.number,
          "اسم العميل": line.client_name,
          "ملاحظات التقرير": line.report_note,
          "إجمالي الفاتورة": line.total_price,
        })),
        { "#": "", "رقم الخط": "", "اسم العميل": "الإجمالي", "ملاحظات التقرير": `${rows.length} خط`, "إجمالي الفاتورة": total } as any,
      ];
    }

    if (isGroupMode) {
      linesByOutlet.forEach((o) => {
        const ws = XLSX.utils.json_to_sheet(buildSheetRows(o.lines));
        XLSX.utils.book_append_sheet(wb, ws, o.name.slice(0, 30) || `منفذ`);
      });
    } else {
      const ws = XLSX.utils.json_to_sheet(buildSheetRows(lines));
      XLSX.utils.book_append_sheet(wb, ws, "كشف حساب");
    }

    XLSX.writeFile(wb, `كشف-${reportTitle}-${year}-${month}.xlsx`);
  }

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div ref={pdfCaptureRef} style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }} />

      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">كشوفات المنافذ والهيئات</h1>
            <p className="text-sm text-slate-500 mt-0.5">استعراض وطباعة كشف حساب لكل منفذ أو جروب كامل</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <div className="grid md:grid-cols-4 gap-4">

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">المنفذ / الهيئة</label>
              <div ref={almanafizRef} className="relative">
                {filterAlmanafiz ? (
                  <div className="flex items-center justify-between border border-blue-300 bg-blue-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-800">{selectedAlmanafiz?.name}</span>
                    </div>
                    <button onClick={() => setFilterAlmanafiz("")}
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
                        disabled={isGroupMode}
                        className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    {showAlmanafizDropdown && !isGroupMode && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
                        {filteredAlmanafiz.length > 0 ? (
                          filteredAlmanafiz.map((a) => (
                            <button key={a.id} type="button"
                              onClick={() => pickAlmanafiz(String(a.id))}
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

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <LayoutGrid className="w-3.5 h-3.5" /> الجروب (كشف مستقل لكل منفذ تابع)
              </label>
              <select value={filterGroup} onChange={(e) => e.target.value ? pickGroup(e.target.value) : setFilterGroup("")}
                disabled={Boolean(filterAlmanafiz)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">بدون — اختاري منفذ لوحده</option>
                {groupsList.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">الشهر (للعنوان فقط)</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="month" value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
              </div>
            </div>

            <div className="flex items-end">
              <button onClick={loadData} disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-medium text-sm transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
                عرض الكشف
              </button>
            </div>
          </div>
        </div>

        {searched && !loading && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
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
            </div>

            {lines.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <button onClick={downloadAllPdfs} disabled={generatingPdf}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
                  {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {isGroupMode ? `تحميل ${linesByOutlet.length} ملف PDF` : "تحميل PDF"}
                </button>
                <button onClick={exportExcel}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  {isGroupMode ? `تحميل Excel (${linesByOutlet.length} شيت)` : "تحميل Excel"}
                </button>
                {generatingPdf && pdfProgress && (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {pdfProgress}
                  </span>
                )}
              </div>
            )}

            {isGroupMode ? (
              <div className="space-y-6">
                {linesByOutlet.map((outlet) => {
                  const outletTotal = outlet.lines.reduce((s, l) => s + l.total_price, 0);
                  return (
                    <div key={outlet.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
                      <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
                        <h2 className="text-base font-bold text-emerald-800">
                          كشف حساب: {outlet.name}
                        </h2>
                        <span className="text-xs text-slate-500">
                          {outlet.lines.length} خط — {outletTotal.toLocaleString()} جنيه
                        </span>
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
                          {outlet.lines.map((line, i) => (
                            <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                              <td className="p-3 text-slate-400">{i + 1}</td>
                              <td className="p-3 font-mono font-medium text-slate-900">{line.number}</td>
                              <td className="p-3">{line.client_name}</td>
                              <td className="p-3 text-slate-500">{line.report_note}</td>
                              <td className="p-3 font-semibold text-slate-900">{line.total_price.toLocaleString()} جنيه</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50 font-bold text-emerald-800 border-t-2 border-emerald-200">
                            <td className="p-3" colSpan={2}>الإجمالي</td>
                            <td className="p-3">{outlet.lines.length} خط</td>
                            <td className="p-3"></td>
                            <td className="p-3">{outletTotal.toLocaleString()} جنيه</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
                {linesByOutlet.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
                    لا توجد خطوط حالياً لهذا الجروب
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
                <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50">
                  <h2 className="text-base font-bold text-blue-800">
                    كشف حساب: {reportTitle}
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
                        <td className="p-3 font-semibold text-slate-900">{line.total_price.toLocaleString()} جنيه</td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          لا توجد خطوط حالياً لهذا المنفذ
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
            )}
          </>
        )}
      </div>
    </div>
  );
}