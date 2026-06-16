"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [number, setNumber] = useState("");
  const [line, setLine] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function searchLine() {
    setLoading(true);

    const { data, error } = await supabase
      .from("lines")
      .select("*")
      .eq("number", number)
      .single();

    if (error) {
      console.log(error);
      setLine(null);
    } else {
      setLine(data);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <div className="max-w-5xl mx-auto">

        <h1 className="text-3xl font-bold text-center mb-8">
          Telecom System
        </h1>

        <div className="bg-white p-6 rounded-xl shadow">

          <div className="flex gap-3">

            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="اكتب رقم الخط"
              className="flex-1 border p-3 rounded-lg"
            />

            <button
              onClick={searchLine}
              className="bg-blue-600 text-white px-6 rounded-lg"
            >
              بحث
            </button>

          </div>

        </div>

        {loading && (
          <div className="mt-6">
            جاري البحث...
          </div>
        )}

        {line && (
          <div className="bg-white p-6 rounded-xl shadow mt-6">

            <h2 className="font-bold text-xl mb-4">
              بيانات الخط
            </h2>

            <p><b>رقم الخط:</b> {line.number}</p>

            <p><b>الشركة:</b> {line.provider_name}</p>

            <p><b>باقة المكالمات:</b> {line.calls_package}</p>

            <p><b>سعر باقة المكالمات:</b> {line.calls_package_price}</p>

            <p><b>باقة الإنترنت:</b> {line.internet_package_name}</p>

            <p><b>سعر الإنترنت:</b> {line.internet_package_price}</p>

            <p><b>الخدمات الإضافية:</b> {line.line_extension_name}</p>

            <p><b>ملاحظات:</b> {line.note}</p>

            <p><b>Report Note:</b> {line.report_note}</p>

            <p><b>القسم:</b> {line.department_name}</p>

            <p><b>الإجمالي:</b> {line.total_price}</p>

            <p><b>التكلفة:</b> {line.total_cost}</p>

          </div>
        )}

      </div>
    </main>
  );
}