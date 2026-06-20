"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ViewLine() {
  const params = useParams();
  const id = params.id as string;

  const [line, setLine] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
 const { data, error } = await supabase
  .from("lines")
  .select("*")
  .eq("id", Number(id))
  .single();

console.log("ID =", id);
console.log("DATA =", data);
console.log("ERROR =", error);

    setLine(data);

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("table_name", "lines")
      .eq("record_id", Number(id))
      .order("created_at", {
        ascending: false,
      });

    setHistory(logs || []);

    setLoading(false);
  }
useEffect(() => {
  if (id) {
    loadData();
  }
}, [id]);
  if (loading) {
    return (
      <div className="p-8">
        جاري التحميل...
      </div>
    );
  }
  if (!line) {
  return (
    <div className="p-10 text-black">
      لا توجد بيانات للخط رقم {id}
    </div>
  );
}

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 p-8 text-black"
    >
      <div className="flex justify-between mb-6">

        <h1 className="text-3xl font-bold">
          بيانات الخط
        </h1>

        <Link
          href="/lines"
          className="bg-blue-600 text-white px-5 py-2 rounded-xl"
        >
          رجوع
        </Link>

      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">

        <div className="grid grid-cols-2 gap-4">

          <div>
            <b>رقم الخط:</b>
            <br />
            {line.number}
          </div>

          <div>
            <b>اسم العميل:</b>
            <br />
            {line.customer_name}
          </div>

          <div>
            <b>رقم الحساب:</b>
            <br />
            {line.account_no}
          </div>

          <div>
            <b>الشبكة:</b>
            <br />
            {line.provider_name}
          </div>

          <div>
            <b>المنفذ:</b>
            <br />
            {line.almanafiz}
          </div>

          <div>
            <b>البائع:</b>
            <br />
            {line.agent_name}
          </div>

          <div>
            <b>القسم:</b>
            <br />
            {line.department}
          </div>

          <div>
            <b>الجروب:</b>
            <br />
            {line.group_name}
          </div>

          <div>
            <b>التاريخ:</b>
            <br />
            {line.customer_date_real}
          </div>

          <div>
            <b>السعر:</b>
            <br />
            {line.total_price}
          </div>

        </div>

      </div>

      <div className="bg-white rounded-2xl shadow p-6">

        <h2 className="text-2xl font-bold mb-4">
          سجل التعديلات
        </h2>

        {history.length === 0 && (
          <div>
            لا يوجد تعديلات
          </div>
        )}

        {history.map((item) => (

          <div
            key={item.id}
            className="border rounded-xl p-4 mb-3"
          >

            <div className="font-bold text-blue-600">
              {item.user_name}
            </div>

            <div className="text-sm text-gray-500 mb-3">
              {new Date(
                item.created_at
              ).toLocaleString("ar-EG")}
            </div>

            {item.old_data?.customer_name && (
              <div className="mb-2">
                تم تعديل اسم العميل
                <br />
                من:
                <b>
                  {" "}
                  {
                    item.old_data
                      .customer_name.old
                  }
                </b>
                <br />
                إلى:
                <b>
                  {" "}
                  {
                    item.old_data
                      .customer_name.new
                  }
                </b>
              </div>
            )}

            {item.old_data?.almanafiz && (
              <div className="mb-2">
                تم تعديل المنفذ
                <br />
                من:
                <b>
                  {" "}
                  {
                    item.old_data
                      .almanafiz.old
                  }
                </b>
                <br />
                إلى:
                <b>
                  {" "}
                  {
                    item.old_data
                      .almanafiz.new
                  }
                </b>
              </div>
            )}

            {item.old_data?.customer_date_real && (
              <div>
                تم تعديل التاريخ
                <br />
                من:
                <b>
                  {" "}
                  {
                    item.old_data
                      .customer_date_real.old
                  }
                </b>
                <br />
                إلى:
                <b>
                  {" "}
                  {
                    item.old_data
                      .customer_date_real.new
                  }
                </b>
              </div>
            )}

          </div>

        ))}

      </div>
    </div>
  );
}