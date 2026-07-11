"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Search, Download, Loader2, X, PhoneCall,
  User, Network, Package, Tag, Calendar,
  DollarSign, Hash, Plug, Briefcase, Building2,
  ListTree, CreditCard, ScanLine, StickyNote, CheckCircle2, XCircle,
} from "lucide-react";

export default function SearchPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [paymentsByNumber, setPaymentsByNumber] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── Parse input ──────────────────────────────────────────
  function parseNumbers(text: string): string[] {
    return text
      .split(/[\n,،\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // ─── Search ───────────────────────────────────────────────
  async function handleSearch() {
    const numbers = parseNumbers(input);
    if (numbers.length === 0) return;

    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from("lines")
      .select(`
        id, number, customer_date_real, total_price, has_sim,
        serial_number, note, report_note,
        calls_package_price, internet_package_price, line_extension_price,
        client_id, provider_id, almanafiz_id, heiaat_id, agent_id,
        account_id, line_status_id, calls_package_id,
        internet_package_id, line_extension_id,
        department_id, group_id,
        clients(name, national_id, address),
        providers(name),
        almanafiz(name),
        heiaat(name),
        agents(name),
        accounts(account_no, account_name),
        line_statuses(name),
        calls_packages(package_name, price),
        internet_packages(package_name, price),
        line_extensions(extension_name, price),
        departments(name),
        groups(name)
      `)
      .in("number", numbers)
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (!error) setResults(data || []);

    // جيبي بيانات السداد لكل الأرقام (على دفعات تحسباً لعدد كبير من الأرقام)
    const paymentsMap = new Map<string, any[]>();
    for (let i = 0; i < numbers.length; i += 500) {
      const batch = numbers.slice(i, i + 500);
      const { data: pays } = await supabase
        .from("payments")
        .select("*")
        .in("line_number", batch);
      (pays || []).forEach((p) => {
        const arr = paymentsMap.get(p.line_number) || [];
        arr.push(p);
        paymentsMap.set(p.line_number, arr);
      });
    }
    setPaymentsByNumber(paymentsMap);

    setLoading(false);
  }

  // ─── Export ───────────────────────────────────────────────
  function exportToExcel() {
    if (results.length === 0) return;

    const rows = results.map((line) => ({
      "رقم الخط": line.number,
      "العميل": (line.clients as any)?.name || "—",
      "الرقم القومي": (line.clients as any)?.national_id || "—",
      "العنوان": (line.clients as any)?.address || "—",
      "الشبكة": (line.providers as any)?.name || "—",
      "الأكونت": (line.accounts as any)?.account_no || "—",
      "اسم الأكونت": (line.accounts as any)?.account_name || "—",
      "المنفذ/الهيئة": (line.almanafiz as any)?.name || (line.heiaat as any)?.name || "—",
      "القسم": (line.departments as any)?.name || "—",
      "الجروب": (line.groups as any)?.name || "—",
      "المندوب": (line.agents as any)?.name || "—",
      "حالة الخط": (line.line_statuses as any)?.name || "—",
      "باقة المكالمات": (line.calls_packages as any)?.package_name || "—",
      "سعر المكالمات": line.calls_package_price || 0,
      "باقة الإنترنت": (line.internet_packages as any)?.package_name || "—",
      "سعر الإنترنت": line.internet_package_price || 0,
      "الإضافة": (line.line_extensions as any)?.extension_name || "—",
      "سعر الإضافة": line.line_extension_price || 0,
      "إجمالي السعر": line.total_price || 0,
      "تاريخ العميل": line.customer_date_real || "—",
      "سيريال نمبر": line.serial_number || "—",
      "على شريحة": line.has_sim ? "نعم" : "لا",
      "ملاحظات": line.note || "—",
      "ملاحظات التقرير": line.report_note || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتائج البحث");
    XLSX.writeFile(wb, `search-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const totalRevenue = results.reduce((s, x) => s + (x.total_price || 0), 0);

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Search className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">البحث المتقدم</h1>
            <p className="text-sm text-slate-500 mt-0.5">ابحث عن خط واحد أو أكتر في نفس الوقت</p>
          </div>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            أرقام الخطوط
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder={`ادخلي رقم أو أكتر  — مفصولين بسطر جديد أو فاصلة:\n01012345678\n01098765432\n01156789012`}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-400">
              {parseNumbers(input).length > 0
                ? `${parseNumbers(input).length} رقم`
                : "ادخلي الأرقام مفصولة بسطر جديد أو فاصلة أو مسافة"}
            </p>
            <div className="flex gap-2">
              {input && (
                <button onClick={() => { setInput(""); setResults([]); setSearched(false); }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition">
                  <X className="w-4 h-4" /> مسح
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={loading || parseNumbers(input).length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-medium text-sm transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                بحث
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري البحث...
          </div>
        )}

        {!loading && searched && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500">نتائج البحث</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{results.length}</p>
                <p className="text-xs text-slate-400">من {parseNumbers(input).length} رقم مدخل</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500">إجمالي الفواتير</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-slate-400">جنيه</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500">أرقام مش موجودة</p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {parseNumbers(input).length - results.length}
                </p>
                <p className="text-xs text-slate-400">رقم</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500">متوسط الفاتورة</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {results.length > 0 ? (totalRevenue / results.length).toFixed(0) : 0}
                </p>
                <p className="text-xs text-slate-400">جنيه</p>
              </div>
            </div>

            {/* Export + Not Found */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex flex-wrap gap-2">
                {/* أرقام مش موجودة */}
                {parseNumbers(input).filter(
                  (n) => !results.find((r) => r.number === n)
                ).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                    <span className="font-semibold">أرقام مش موجودة: </span>
                    {parseNumbers(input)
                      .filter((n) => !results.find((r) => r.number === n))
                      .join("، ")}
                  </div>
                )}
              </div>
              {results.length > 0 && (
                <button onClick={exportToExcel}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium text-sm transition shadow-sm">
                  <Download className="w-4 h-4" /> تحميل Excel
                </button>
              )}
            </div>

            {/* Cards */}
            {results.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
                لا توجد نتائج
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((line) => {
                  const pays = paymentsByNumber.get(line.number) || [];
                  const isPaid = pays.length > 0;
                  const totalPaid = pays.reduce((s, p) => s + (p.amount || 0), 0);
                  return (
                  <div key={line.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                    {/* Card Header */}
                    <div className="bg-gradient-to-l from-blue-600 to-blue-500 px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                          <PhoneCall className="w-5 h-5 text-white" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-lg font-mono">{line.number}</p>
                            <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              isPaid ? "bg-green-500/25 text-green-50" : "bg-red-500/25 text-red-50"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-green-400" : "bg-red-400"}`} />
                              {isPaid ? "مسدد" : "غير مسدد"}
                            </span>
                          </div>
                          <p className="text-blue-100 text-xs">
                            {(line.providers as any)?.name || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-bold text-xl">{(line.total_price || 0).toLocaleString()}</p>
                        <p className="text-blue-100 text-xs">جنيه</p>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

                      {/* العميل */}
                      <InfoField icon={User} label="العميل"
                        value={(line.clients as any)?.name || "—"} />
                      <InfoField icon={Hash} label="الرقم القومي"
                        value={(line.clients as any)?.national_id || "—"} />
                      <InfoField icon={Building2} label="العنوان"
                        value={(line.clients as any)?.address || "—"} />
                      <InfoField icon={Calendar} label="تاريخ العميل"
                        value={line.customer_date_real || "—"} />

                      {/* الشبكة */}
                      <InfoField icon={Network} label="الشبكة"
                        value={(line.providers as any)?.name || "—"} />
                      <InfoField icon={CreditCard} label="الأكونت"
                        value={(line.accounts as any)?.account_no || "—"} />
                      <InfoField icon={Plug} label="المنفذ/الهيئة"
                        value={(line.almanafiz as any)?.name || (line.heiaat as any)?.name || "—"} />
                      <InfoField icon={ListTree} label="الجروب"
                        value={(line.groups as any)?.name || "—"} />
                      <InfoField icon={Building2} label="القسم"
                        value={(line.departments as any)?.name || "—"} />
                      <InfoField icon={Briefcase} label="المندوب"
                        value={(line.agents as any)?.name || "—"} />
                      <InfoField icon={Tag} label="حالة الخط"
                        value={(line.line_statuses as any)?.name || "—"} />
                      <InfoField icon={ScanLine} label="سيريال نمبر"
                        value={line.serial_number || "—"} />

                      {/* الباقات */}
                      <InfoField icon={Package} label="باقة المكالمات"
                        value={(line.calls_packages as any)?.package_name || "—"}
                        sub={line.calls_package_price ? `${line.calls_package_price} جنيه` : undefined} />
                      <InfoField icon={Package} label="باقة الإنترنت"
                        value={(line.internet_packages as any)?.package_name || "—"}
                        sub={line.internet_package_price ? `${line.internet_package_price} جنيه` : undefined} />
                      <InfoField icon={Package} label="الإضافة"
                        value={(line.line_extensions as any)?.extension_name || "—"}
                        sub={line.line_extension_price ? `${line.line_extension_price} جنيه` : undefined} />
                      <InfoField icon={Tag} label="على شريحة"
                        value={line.has_sim ? "نعم ✅" : "لا ❌"} />

                      {/* ملاحظات */}
                      {line.note && (
                        <div className="col-span-2">
                          <InfoField icon={StickyNote} label="ملاحظات" value={line.note} />
                        </div>
                      )}
                      {line.report_note && (
                        <div className="col-span-2">
                          <InfoField icon={StickyNote} label="ملاحظات التقرير" value={line.report_note} />
                        </div>
                      )}
                    </div>

                    {/* بيانات السداد */}
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                        {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        بيانات السداد
                        {isPaid && (
                          <span className="text-green-600 font-normal">
                            (إجمالي المسدد: {totalPaid.toLocaleString()} جنيه)
                          </span>
                        )}
                      </div>
                      {pays.length === 0 ? (
                        <p className="text-xs text-slate-400">لا توجد سدادات مسجلة لهذا الخط</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="text-right py-1 pl-3 font-medium">المبلغ</th>
                                <th className="text-right py-1 pl-3 font-medium">طريقة السداد</th>
                                <th className="text-right py-1 pl-3 font-medium">شهر السداد</th>
                                <th className="text-right py-1 pl-3 font-medium">تاريخ العملية</th>
                                <th className="text-right py-1 pl-3 font-medium">المتبقي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pays.map((p) => (
                                <tr key={p.id} className="border-t border-slate-50">
                                  <td className="py-1.5 pl-3 font-semibold text-green-600">{(p.amount || 0).toLocaleString()} جنيه</td>
                                  <td className="py-1.5 pl-3 text-slate-600">{p.payment_code || "—"}</td>
                                  <td className="py-1.5 pl-3 text-slate-600">{p.payment_month || "—"}</td>
                                  <td className="py-1.5 pl-3 text-slate-400">{p.trans_date || "—"}</td>
                                  <td className="py-1.5 pl-3 text-slate-600">{p.remaining != null ? p.remaining.toLocaleString() : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* إجمالي */}
                    <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>مكالمات: <strong className="text-slate-700">{(line.calls_package_price || 0).toLocaleString()}</strong></span>
                        <span>إنترنت: <strong className="text-slate-700">{(line.internet_package_price || 0).toLocaleString()}</strong></span>
                        <span>إضافة: <strong className="text-slate-700">{(line.line_extension_price || 0).toLocaleString()}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-bold text-green-600">{(line.total_price || 0).toLocaleString()} جنيه</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoField({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
      {sub && <p className="text-xs text-green-600 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}