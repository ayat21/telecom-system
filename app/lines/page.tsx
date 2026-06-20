"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";

export default function LinesPage() {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("");
const [almanafiz, setAlmanafiz] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const router = useRouter();
  const PAGE_SIZE = 50;

  const [stats, setStats] = useState({
    totalLines: 0,
    vodafone: 0,
    orange: 0,
    etisalat: 0,
    totalSales: 0,
  });

  const role = localStorage.getItem("role") || "";
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
    query = query.ilike(
      "provider_name",
      `%${provider}%`
    );
  }

  if (almanafiz) {
    query = query.ilike(
      "almanafiz",
      `%${almanafiz}%`
    );
  }

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
if (toDate) {
  query = query.lte(
    "customer_date_real",
    toDate
  );
}

  query = query.range(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE - 1
  );

  const { data, error } = await query;
  console.log("LINES DATA", data);

  if (!error) {
    setLines(data || []);
  }

  setLoading(false);
}
async function deleteLine(id: number) {

  if (
    !confirm(
      "هل أنت متأكد من حذف الخط؟"
    )
  )
    return;

  const row =
    lines.find(
      (x: any) =>
        x.id === id
    );

  await supabase
    .from("audit_logs")
    .insert({
      user_name:
        localStorage.getItem(
          "full_name"
        ) || "Unknown",

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

  const { count } = await supabase
    .from("lines")
    .select("*", {
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

  const worksheet =
    XLSX.utils.json_to_sheet(lines);

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Lines"
  );

  XLSX.writeFile(
    workbook,
    "telecom-lines.xlsx"
  );
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
}, [
  search,
  provider,
  almanafiz,
  fromDate,
  toDate,
  page,
]);


  return (
    
<div className="min-h-screen bg-slate-50 p-8" dir="rtl">

<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

<div className="bg-gradient-to-r from-blue-600 to-sky-500 text-white rounded-2xl shadow-lg p-4">    
<div className="text-lg font-semibold opacity-90">      إجمالي الخطوط
    </div>
    <div className="text-3xl font-bold">
      {stats.totalLines}
    </div>
  </div>

<div className="bg-gradient-to-r from-emerald-600 to-green-500 text-white rounded-2xl shadow-lg p-4">    
<div className="text-lg font-semibold opacity-90">      اتصالات
    </div>
    <div className="text-3xl font-bold">
      {stats.etisalat}
    </div>
  </div>

<div className="bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-2xl shadow-lg p-4">   
<div className="text-lg font-semibold opacity-90">      أورنج
    </div>
    <div className="text-3xl font-extrabold mt-2">
      {stats.orange}
    </div>
  </div>

<div className="bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-2xl shadow-lg p-4">  
<div className="text-lg font-semibold opacity-90">      فودافون
    </div>
    <div className="text-3xl font-bold">
      {stats.vodafone}
    </div>
  </div>

</div>
<div className="mb-6">
  <Link
    href="/lines/new"
className="bg-blue-500 hover:bg-blue-700 transition text-white px-6 py-3 rounded-xl shadow"  >
    إضافة خط جديد
  </Link>
  <button
  onClick={exportToExcel}
  className="bg-emerald-600 text-white px-5 py-3 rounded-xl"
>
  تحميل Excel
</button>
</div>



     <div className="flex gap-3 mb-8">

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الخط أو اسم العميل"
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={loadLines}
         className="bg-blue-500 hover:bg-blue-700 transition text-white px-8 rounded-xl shadow"
        >
          بحث
        </button>

      </div>
      <div className="text-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">

  <select
    value={provider}
    onChange={(e) => setProvider(e.target.value)}
    className="border rounded-lg p-3"
  >
    <option value="">كل الشبكات</option>
    <option value="vodafone">فودافون</option>
    <option value="etisalat">اتصالات</option>
    <option value="orange">أورنج</option>
  </select>

  <input
    value={almanafiz}
    onChange={(e) => setAlmanafiz(e.target.value)}
    placeholder="المنفذ"
    className="border rounded-lg p-3"
  />

  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    className="border rounded-lg p-3"
  />

  <input
  type="date"
  value={toDate}
  onChange={(e) => setToDate(e.target.value)}
  className="border rounded-lg p-3"
  lang="en"
/>

</div>

      {loading ? (
        <div>جاري التحميل...</div>
      ) : (
       <div className="overflow-auto bg-white rounded-2xl shadow-lg border border-slate-200">

          <table className="w-full text-xs ">

            <thead className="bg-slate-100 text-slate-700">

              <tr>
                <th className="p-3 text-right">الرقم</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">المنفذ</th>
                <th className="p-3 text-right">ملاحظات</th>
                <th className="p-3 text-right">باقة المكالمات</th>
                <th className="p-3 text-right">الشبكة</th>
                <th className="p-3 text-right">اجمالى السعر</th>
                <th className="p-3">إجراءات</th>
              </tr>

            </thead>

            <tbody  className="text-slate-700 text-slate-900 text-[15px]" >

              {lines.map((line) => (

                <tr
                  key={line.id}
                  className="border-t hover:bg-slate-50 transition"
                >
                  <td className="p-3">{line.number}</td>

                  <td className="p-3">
                    {line.customer_name}
                  </td>
                   <td className="p-3">
                    {line.customer_date_real}
                  </td>

                  <td className="p-3">
                    {line.almanafiz}
                  </td>

                  <td className="p-3">
                    {line.report_note}
                  </td>

                  <td className="p-3">
                    {line.calls_package}
                  </td>

                  <td className="p-3">
                    {line.provider_name}
                  </td>

                  <td className="p-3">
                    {line.total_price}
                  </td>
                 <td className="p-3">
               <td className="flex gap-2">

  <button
    onClick={() =>
      router.push(`/lines/view/${line.id}`)
    }
    className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded-lg"
  >
    👁 
  </button>

 {(isSuperAdmin || isAdmin) && (
  <button
    onClick={() =>
      router.push(`/lines/${line.id}`)
    }
    className="bg-green-600 text-white px-3 py-2 rounded-lg"
  >
    ✏️
  </button>
)}

  {(isSuperAdmin ) &&(
  <button
    onClick={() =>
      deleteLine(line.id)
    }
    className="bg-red-600 text-white px-3 py-2 rounded-lg"
  >
    🗑
  </button>
)}

</td>
                
                </td>
                </tr>

              ))}

            </tbody>

          </table>
          <div className="flex justify-start items-center gap-2 mt-6" dir="ltr">

  <button
    disabled={page === 1}
    onClick={() => setPage(page - 1)}
    className="px-4 py-2 rounded-lg border border-slate-300 bg-blue-600 hover:bg-slate-100 disabled:opacity-40"
  >
    ← السابق
  </button>

  <span className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold">
    {page}
  </span>

  <button
    onClick={() => setPage(page + 1)}
    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
  >
    التالى →
  </button>

</div>

        </div>
      )}

    </div>
  );
}