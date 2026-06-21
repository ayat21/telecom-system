"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import {
  PhoneCall,
  Wifi,
  Signal,
  Radio,
  PlusCircle,
  Download,
  Search,
  Filter,
  Calendar,
  Network,
  Eye,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";

export default function LinesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
  const role = localStorage.getItem("role");

  setRole(role || "");

  if (!role) {
    router.replace("/login");
    return;
  }

  setAuthorized(true);
}, []);

  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("");
  const [almanafiz, setAlmanafiz] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const PAGE_SIZE = 50;

  const [stats, setStats] = useState({
    totalLines: 0,
    vodafone: 0,
    orange: 0,
    etisalat: 0,
    totalSales: 0,
  });

  const [role, setRole] = useState("");
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isViewer = role === "viewer";

  async function loadLines() {
    setLoading(true);

    let query = supabase
      .from("lines")
      .select("*")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("id", { ascending: false });

    if (search.trim()) {
      query = query.or(
        `number.ilike.%${search}%,customer_name.ilike.%${search}%`
      );
    }

    if (provider) {
      query = query.ilike("provider_name", `%${provider}%`);
    }

    if (almanafiz) {
      query = query.ilike("almanafiz", `%${almanafiz}%`);
    }

    if (fromDate) {
      query = query.gte("customer_date_real", fromDate);
    }

    if (toDate) {
      query = query.lte("customer_date_real", toDate);
    }
    if (toDate) {
      query = query.lte("customer_date_real", toDate);
    }

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error } = await query;
    console.log("LINES DATA", data);

    if (!error) {
      setLines(data || []);
    }

    setLoading(false);
  }
  async function deleteLine(id: number) {
    if (!confirm("هل أنت متأكد من حذف الخط؟")) return;

    const row = lines.find((x: any) => x.id === id);

    await supabase.from("audit_logs").insert({
      user_name: localStorage.getItem("full_name") || "Unknown",

      action_type: "DELETE",

      table_name: "lines",

      record_id: id,

      old_data: row,
    });

    console.log("DELETE ID =", id);

    const { data, error } = await supabase
      .from("lines")
      .update({
        is_deleted: true,
      })
      .eq("id", Number(id))
      .select();

    console.log("UPDATED ROWS =", data);
    console.log("ERROR =", error);

    await loadLines();
    console.log(error);
  }

  async function loadStats() {
    const { count } = await supabase.from("lines").select("*", {
      count: "exact",
      head: true,
    });

    const { count: vodafone } = await supabase
      .from("lines")
      .select("*", {
        count: "exact",
        head: true,
      })
      .ilike("provider_name", "%vodafone%");

    const { count: orange } = await supabase
      .from("lines")
      .select("*", {
        count: "exact",
        head: true,
      })
      .ilike("provider_name", "%orange%");

    const { count: etisalat } = await supabase
      .from("lines")
      .select("*", {
        count: "exact",
        head: true,
      })
      .ilike("provider_name", "%etisalat%");

    setStats({
      totalLines: count || 0,
      vodafone: vodafone || 0,
      orange: orange || 0,
      etisalat: etisalat || 0,
      totalSales: 0,
    });
  }
  function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(lines);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Lines");

    XLSX.writeFile(workbook, "telecom-lines.xlsx");
  }

  useEffect(() => {
    loadLines();
    loadStats();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadLines();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, provider, almanafiz, fromDate, toDate, page]);

  if (!authorized) {
    return null;
  }
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <PhoneCall className="w-6 h-6 text-blue-600" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            إدارة الخطوط
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            عرض وإدارة كل الخطوط المسجلة في النظام
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">إجمالي الخطوط</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {stats.totalLines}
            </p>
          </div>
          <span className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-blue-600" />
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">اتصالات</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.etisalat}
            </p>
          </div>
          <span className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center shrink-0">
            <Signal className="w-5 h-5 text-green-600" />
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">أورنج</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats.orange}
            </p>
          </div>
          <span className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5 text-orange-600" />
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">فودافون</p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {stats.vodafone}
            </p>
          </div>
          <span className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-red-600" />
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link
          href="/lines/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          إضافة خط جديد
        </Link>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-700 px-5 py-2.5 rounded-xl shadow-sm font-medium text-sm"
        >
          <Download className="w-4 h-4" />
          تحميل Excel
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الخط أو اسم العميل"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
            />
          </div>

          <button
            onClick={loadLines}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-6 rounded-xl shadow-sm font-medium text-sm"
          >
            <Search className="w-4 h-4" />
            بحث
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none"
            >
              <option value="">كل الشبكات</option>
              <option value="vodafone">فودافون</option>
              <option value="etisalat">اتصالات</option>
              <option value="orange">أورنج</option>
            </select>
          </div>

          <div className="relative">
            <Network className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={almanafiz}
              onChange={(e) => setAlmanafiz(e.target.value)}
              placeholder="المنفذ"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              lang="en"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 bg-white rounded-2xl shadow-sm border border-slate-100 py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          جاري التحميل...
        </div>
      ) : (
        <div className="overflow-auto bg-white rounded-2xl shadow-sm border border-slate-100">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">الرقم</th>
                <th className="p-3 text-right font-medium">العميل</th>
                <th className="p-3 text-right font-medium">التاريخ</th>
                <th className="p-3 text-right font-medium">المنفذ</th>
                <th className="p-3 text-right font-medium">ملاحظات</th>
                <th className="p-3 text-right font-medium">باقة المكالمات</th>
                <th className="p-3 text-right font-medium">الشبكة</th>
                <th className="p-3 text-right font-medium">اجمالى السعر</th>
                <th className="p-3 text-center font-medium">إجراءات</th>
              </tr>
            </thead>

            <tbody className="text-slate-700 text-[15px]">
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-t border-slate-100 hover:bg-slate-50/80 transition"
                >
                  <td className="p-3 font-medium text-slate-900">
                    {line.number}
                  </td>

                  <td className="p-3">{line.customer_name}</td>
                  <td className="p-3 text-slate-500">
                    {line.customer_date_real}
                  </td>

                  <td className="p-3">{line.almanafiz}</td>

                  <td className="p-3 text-slate-500">{line.report_note}</td>

                  <td className="p-3">{line.calls_package}</td>

                  <td className="p-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {line.provider_name}
                    </span>
                  </td>

                  <td className="p-3 font-semibold text-slate-900">
                    {line.total_price}
                  </td>
                  <td className="p-3">
                    <td className="flex gap-2 justify-center">
                      <button
                        onClick={() =>
                          router.push(`/lines/view/${line.id}`)
                        }
                        title="عرض"
                        className="bg-sky-50 hover:bg-sky-100 text-sky-600 w-8 h-8 flex items-center justify-center rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(isSuperAdmin || isAdmin) && (
                        <button
                          onClick={() => router.push(`/lines/${line.id}`)}
                          title="تعديل"
                          className="bg-green-50 hover:bg-green-100 text-green-600 w-8 h-8 flex items-center justify-center rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {isSuperAdmin && (
                        <button
                          onClick={() => deleteLine(line.id)}
                          title="حذف"
                          className="bg-red-50 hover:bg-red-100 text-red-600 w-8 h-8 flex items-center justify-center rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div
            className="flex justify-start items-center gap-2 p-4 border-t border-slate-100"
            dir="ltr"
          >
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              السابق
            </button>

            <span className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">
              {page}
            </span>

            <button
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
            >
              التالى
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}