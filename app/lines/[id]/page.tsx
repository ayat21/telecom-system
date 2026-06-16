"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EditLine({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [line, setLine] = useState<any>(null);
  const [id, setId] = useState("");

  useEffect(() => {
    async function init() {
      const p = await params;
      setId(p.id);

      const { data, error } = await supabase
        .from("lines")
        .select("*")
        .eq("id", p.id)
        .single();

      if (!error) {
        setLine(data);
      }
    }

    init();
  }, [params]);

  async function save() {
    const { error } = await supabase
      .from("lines")
      .update({
        customer_name: line.customer_name,
        department: line.department,
        group_name: line.group_name,
        note: line.note,
        report_note: line.report_note,
        total_price: line.total_price,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("تم حفظ التعديلات");
  }

  if (!line) {
    return <div className="p-6">جاري التحميل...</div>;
  }

  return (
    <div className="p-6 max-w-3xl">

      <h1 className="text-3xl font-bold mb-6">
        تعديل الخط
      </h1>

      <div className="space-y-4">

        <input
          className="border p-3 w-full"
          value={line.number || ""}
          disabled
        />

        <input
          className="border p-3 w-full"
          value={line.customer_name || ""}
          onChange={(e) =>
            setLine({
              ...line,
              customer_name: e.target.value,
            })
          }
        />

        <input
          className="border p-3 w-full"
          value={line.department || ""}
          onChange={(e) =>
            setLine({
              ...line,
              department: e.target.value,
            })
          }
        />

        <input
          className="border p-3 w-full"
          value={line.group_name || ""}
          onChange={(e) =>
            setLine({
              ...line,
              group_name: e.target.value,
            })
          }
        />

        <input
          className="border p-3 w-full"
          value={line.total_price || ""}
          onChange={(e) =>
            setLine({
              ...line,
              total_price: e.target.value,
            })
          }
        />

        <textarea
          className="border p-3 w-full"
          rows={5}
          value={line.note || ""}
          onChange={(e) =>
            setLine({
              ...line,
              note: e.target.value,
            })
          }
        />

        <button
          onClick={save}
          className="bg-green-600 text-white px-6 py-3 rounded"
        >
          حفظ التعديلات
        </button>

      </div>

    </div>
  );
}