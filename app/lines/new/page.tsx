"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function NewLine() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    number: "",
    account_no: "",
    customer_name: "",
    customer_date: "",
    almanafiz: "",
    calls_package: "",
    calls_package_price: "",
    internet_package_name: "",
    internet_package_price: "",
    line_extension_name: "",
    line_extension_price: "",
    provider_name: "",
    note: "",
    report_note: "",
    agent_name: "",
    department: "",
    group_name: "",
    total_price: "",
  });

  async function save() {
    if (!form.number) {
      alert("رقم الخط مطلوب");
      return;
    }
    

    setLoading(true);

    const { error } = await supabase.from("lines").insert({
      ...form,
      calls_package_price: Number(form.calls_package_price || 0),

      internet_package_price: Number(form.internet_package_price || 0),

      line_extension_price: Number(form.line_extension_price || 0),

      total_price: Number(form.total_price || 0),
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("تم إضافة الخط بنجاح");

    setForm({
      number: "",
      account_no: "",
      customer_name: "",
      customer_date: "",
      almanafiz: "",
      calls_package: "",
      calls_package_price: "",
      internet_package_name: "",
      internet_package_price: "",
      line_extension_name: "",
      line_extension_price: "",
      provider_name: "",
      note: "",
      report_note: "",
      agent_name: "",
      department: "",
      group_name: "",
      total_price: "",
    });
  }
  const router = useRouter();
useEffect(() => {
  const role =
    localStorage.getItem("role");

  if (
    role !== "admin" &&
    role !== "super_admin"
  ) {
    router.push("/lines");
  }
}, []);
  function update(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }
  

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8 border-b pb-4">
        <div className="mb-8 border-b pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-black text-3xl font-bold">اضافة خط جديد</h1>

            <button
              onClick={() => router.back()}
              className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg"
            >
              ← رجوع
            </button>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <input
          placeholder="رقم الخط"
          value={form.number}
          onChange={(e) => update("number", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="رقم الحساب"
          value={form.account_no}
          onChange={(e) => update("account_no", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="اسم العميل"
          value={form.customer_name}
          onChange={(e) => update("customer_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="تاريخ العميل"
          value={form.customer_date}
          onChange={(e) => update("customer_date", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="المنفذ"
          value={form.almanafiz}
          onChange={(e) => update("almanafiz", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="الشبكة"
          value={form.provider_name}
          onChange={(e) => update("provider_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="باقة المكالمات"
          value={form.calls_package}
          onChange={(e) => update("calls_package", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="سعر باقة المكالمات"
          value={form.calls_package_price}
          onChange={(e) => update("calls_package_price", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="باقة الإنترنت"
          value={form.internet_package_name}
          onChange={(e) => update("internet_package_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="سعر باقة الإنترنت"
          value={form.internet_package_price}
          onChange={(e) => update("internet_package_price", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="الإضافة"
          value={form.line_extension_name}
          onChange={(e) => update("line_extension_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="سعر الإضافة"
          value={form.line_extension_price}
          onChange={(e) => update("line_extension_price", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="المندوب"
          value={form.agent_name}
          onChange={(e) => update("agent_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="القسم"
          value={form.department}
          onChange={(e) => update("department", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="الجروب"
          value={form.group_name}
          onChange={(e) => update("group_name", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          placeholder="إجمالي السعر"
          value={form.total_price}
          onChange={(e) => update("total_price", e.target.value)}
          className="border border-slate-300 bg-white text-black p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <textarea
        placeholder="ملاحظات"
        value={form.note}
        onChange={(e) => update("note", e.target.value)}
        className="border p-3 rounded w-full mt-4"
        rows={4}
      />

      <textarea
        placeholder="ملاحظات التقرير"
        value={form.report_note}
        onChange={(e) => update("report_note", e.target.value)}
        className="border p-3 rounded w-full mt-4"
        rows={4}
      />

      <button
        onClick={save}
        disabled={loading}
        className="bg-green-600 text-white px-8 py-3 rounded mt-6"
      >
        {loading ? "جاري الحفظ..." : "حفظ الخط"}
      </button>
    </div>
  );
}
