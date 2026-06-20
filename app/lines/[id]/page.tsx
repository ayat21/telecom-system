"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EditLine({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [line, setLine] = useState<any>(null);

  const [id, setId] = useState("");

  const [providers, setProviders] = useState<any[]>([]);

  const [almanafizList, setAlmanafizList] = useState<any[]>([]);

  const [departments, setDepartments] = useState<any[]>([]);

  const [groups, setGroups] = useState<any[]>([]);

  const [callsPackages, setCallsPackages] = useState<any[]>([]);

  const [internetPackages, setInternetPackages] = useState<any[]>([]);

  const [services, setServices] = useState<any[]>([]);
  const [originalLine, setOriginalLine] =
  useState<any>(null);
  const [history, setHistory] =
  useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const p = await params;

      setId(p.id);

      const { data } = await supabase

        .from("lines")

        .select("*")

        .eq("id", p.id)

        .single();

      if (data) {
  setLine(data);
  setOriginalLine(data);
  await loadHistory(p.id);

  await handleProviderChange(
    data.provider_name
  );
}
    }

    init();
  }, [params]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (!line) return;

    const total =
      Number(line.calls_package_price || 0) +
      Number(line.internet_package_price || 0) +
      Number(line.line_extension_price || 0);

    setLine((prev: any) => ({
      ...prev,

      total_price: total,
    }));
  }, [
    line?.calls_package_price,

    line?.internet_package_price,

    line?.line_extension_price,
  ]);

  async function loadLookups() {
    const { data: p } = await supabase

      .from("providers")

      .select("*");

    const { data: a } = await supabase

      .from("almanafiz")

      .select("*");

    const { data: d } = await supabase

      .from("departments")

      .select("*");

    const { data: g } = await supabase

      .from("groups")

      .select("*");

    setProviders(p || []);

    setAlmanafizList(a || []);

    setDepartments(d || []);

    setGroups(g || []);
  }

  async function handleProviderChange(provider: string) {
    const { data: calls } = await supabase

      .from("calls_packages")

      .select("*")

      .eq(
        "provider_name",

        provider,
      );

    const { data: internet } = await supabase

      .from("internet_packages")

      .select("*")

      .eq(
        "provider_name",

        provider,
      );

    const { data: ext } = await supabase

      .from("line_extensions")

      .select("*")

      .eq(
        "provider_name",

        provider,
      );

    setCallsPackages(calls || []);

    setInternetPackages(internet || []);

    setServices(ext || []);

    setLine((prev: any) => ({
      ...prev,

      provider_name: provider,
    }));
  }
  const router = useRouter();

  async function loadHistory(
  lineId: string
) {
  const { data } =
    await supabase
      .from("audit_logs")
      .select("*")
      .eq(
        "table_name",
        "lines"
      )
      .eq(
        "record_id",
        Number(lineId)
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  setHistory(data || []);
}

 async function save() {

  const oldLine = { ...line };
const changes: any = {};

if (originalLine.customer_name !== line.customer_name) {
  changes.customer_name = {
    old: originalLine.customer_name,
    new: line.customer_name,
  };
}

if (originalLine.almanafiz !== line.almanafiz) {
  changes.almanafiz = {
    old: originalLine.almanafiz,
    new: line.almanafiz,
  };
}

if (
  originalLine.customer_date_real !==
  line.customer_date_real
) {
  changes.customer_date_real = {
    old: originalLine.customer_date_real,
    new: line.customer_date_real,
  };
}
if (Object.keys(changes).length > 0) {
  await supabase
    .from("audit_logs")
    .insert({
      user_name:
        localStorage.getItem("full_name") ||
        "Unknown",

      action_type: "UPDATE",

      table_name: "lines",

      record_id: Number(id),

      old_data: changes,
    });
}

 

  const updatedData = {
  account_no: line.account_no,
  customer_name: line.customer_name,
  customer_date_real: line.customer_date_real,
  almanafiz: line.almanafiz,
  calls_package: line.calls_package,
  calls_package_price: line.calls_package_price,
  internet_package_name: line.internet_package_name,
  internet_package_price: line.internet_package_price,
  line_extension_name: line.line_extension_name,
  line_extension_price: line.line_extension_price,
  provider_name: line.provider_name,
  note: line.note,
  report_note: line.report_note,
  agent_name: line.agent_name,
  department: line.department,
  group_name: line.group_name,
  total_price: line.total_price,
};

const { error } = await supabase
  .from("lines")
  .update(updatedData)
  .eq("id", id);
  alert("تم حفظ التعديلات");
  await loadHistory(id);
  setOriginalLine(line);
}

  if (!line) {
    return <div className="p-8">جاري التحميل...</div>;
  }
  return (
    <div className="min-h-screen bg-slate-50 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-lg p-8">
        <div className="mb-8 border-b pb-4">
          <div className="mb-8 border-b pb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-black text-3xl font-bold">
                تعديل بيانات الخط
              </h1>

              <button
                onClick={() => router.back()}
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg"
              >
                ← رجوع
              </button>
            </div>

            <p className="text-slate-500 mt-2">رقم الخط: {line.number}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="رقم الحساب"
            className="border rounded-xl p-3 text-slate-900"
            value={line.account_no || ""}
            onChange={(e) =>
              setLine({
                ...line,

                account_no: e.target.value,
              })
            }
          />

          <input
            placeholder="اسم العميل"
            className="border rounded-xl p-3 text-slate-900"
            value={line.customer_name || ""}
            onChange={(e) =>
              setLine({
                ...line,

                customer_name: e.target.value,
              })
            }
          />

          <input
            type="date"
            className="border rounded-xl p-3 text-slate-900"
            value={line.customer_date_real || ""}
            onChange={(e) =>
              setLine({
                ...line,

                customer_date_real: e.target.value,
              })
            }
          />

          <input
            placeholder="اسم المندوب"
            className="border rounded-xl p-3 text-slate-900"
            value={line.agent_name || ""}
            onChange={(e) =>
              setLine({
                ...line,

                agent_name: e.target.value,
              })
            }
          />

          <select
            className="border rounded-xl p-3 text-slate-900"
            value={line.provider_name || ""}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="">اختر الشبكة</option>

            {providers.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            className="border rounded-xl p-3 text-slate-900"
            value={line.almanafiz || ""}
            onChange={(e) =>
              setLine({
                ...line,

                almanafiz: e.target.value,
              })
            }
          >
            <option value="">اختر المنفذ</option>

            {almanafizList.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            placeholder="القسم"
            className="border rounded-xl p-3 text-slate-900"
            value={line.department || ""}
            onChange={(e) =>
              setLine({
                ...line,

                department: e.target.value,
              })
            }
          />

          <input
            placeholder="الجروب"
            className="border rounded-xl p-3 text-slate-900"
            value={line.group_name || ""}
            onChange={(e) =>
              setLine({
                ...line,

                group_name: e.target.value,
              })
            }
          />

          <select
            className="border rounded-xl p-3 text-slate-900"
            value={line.calls_package || ""}
            onChange={(e) => {
              const selected = callsPackages.find(
                (x) => x.package_name === e.target.value,
              );

              setLine({
                ...line,

                calls_package: selected?.package_name || "",

                calls_package_price: selected?.price || 0,
              });
            }}
          >
            <option value="">باقة المكالمات</option>

            {callsPackages.map((item) => (
              <option key={item.id} value={item.package_name}>
                {item.package_name}
              </option>
            ))}
          </select>

          <input
            disabled
            className="border rounded-xl p-3 bg-slate-100"
            value={line.calls_package_price || ""}
          />

          <select
            className="border rounded-xl p-3 text-slate-900"
            value={line.internet_package_name || ""}
            onChange={(e) => {
              const selected = internetPackages.find(
                (x) => x.package_name === e.target.value,
              );

              setLine({
                ...line,

                internet_package_name: selected?.package_name || "",

                internet_package_price: selected?.price || 0,
              });
            }}
          >
            <option value="">باقة النت</option>

            {internetPackages.map((item) => (
              <option key={item.id} value={item.package_name}>
                {item.package_name}
              </option>
            ))}
          </select>

          <input
            disabled
            className="border rounded-xl p-3 bg-slate-100"
            value={line.internet_package_price || ""}
          />

          <select
            className="border rounded-xl p-3 text-slate-900"
            value={line.line_extension_name || ""}
            onChange={(e) => {
              const selected = services.find(
                (x) => x.extension_name === e.target.value,
              );

              setLine({
                ...line,

                line_extension_name: selected?.extension_name || "",

                line_extension_price: selected?.price || 0,
              });
            }}
          >
            <option value="">الخدمة</option>

            {services.map((item) => (
              <option key={item.id} value={item.extension_name}>
                {item.extension_name}
              </option>
            ))}
          </select>

          <input
            disabled
            className="border rounded-xl p-3 bg-slate-100"
            value={line.line_extension_price || ""}
          />
        </div>

        <div className="mt-4">
          <input
            className="w-full border rounded-xl p-3 bg-slate-100 font-bold"
            value={line.total_price || 0}
            disabled
          />
        </div>

        <div className="mt-4">
          <textarea
            rows={4}
            placeholder="ملاحظات"
            className="w-full border rounded-xl p-3"
            value={line.note || ""}
            onChange={(e) =>
              setLine({
                ...line,

                note: e.target.value,
              })
            }
          />
        </div>

        <div className="mt-4">
          <textarea
            rows={4}
            placeholder="ملاحظات التقرير"
            className="w-full border rounded-xl p-3"
            value={line.report_note || ""}
            onChange={(e) =>
              setLine({
                ...line,

                report_note: e.target.value,
              })
            }
          />
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl"
          >
            حفظ التعديلات
          </button>
        </div>
    {history.map((item) => (

<div
  key={item.id}
  className="border rounded-xl p-3 mb-3 text-black"
>

<div className="flex justify-between">

<span className="font-bold">
  {item.user_name}
</span>

<span className="text-sm text-black">
  {new Date(
    item.created_at
  ).toLocaleString("ar-EG")}
</span>

</div>

{item.old_data?.customer_name && (

<div className="mt-2">

تم تعديل اسم العميل

<br />

من:
<b>
 {item.old_data.customer_name.old}
</b>

<br />

إلى:
<b>
 {item.old_data.customer_name.new}
</b>

</div>

)}

{item.old_data?.almanafiz && (

<div className="mt-2">

تم تعديل المنفذ

<br />

من:
<b>
 {item.old_data.almanafiz.old}
</b>

<br />

إلى:
<b>
 {item.old_data.almanafiz.new}
</b>

</div>

)}

{item.old_data?.customer_date_real && (

<div className="mt-2">

تم تعديل التاريخ

<br />

من:
<b>
 {item.old_data.customer_date_real.old}
</b>

<br />

إلى:
<b>
 {item.old_data.customer_date_real.new}
</b>

</div>

)}

</div>

))}
      </div>
    </div>
  );
}
