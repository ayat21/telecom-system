"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  PhoneCall,
  User,
  Hash,
  Network,
  Plug,
  Briefcase,
  Building2,
  ListTree,
  Calendar,
  Banknote,
  History,
  Loader2,
  FileX,
  Clock,
} from "lucide-react";

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
      <div
        dir="rtl"
        className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        جاري التحميل...
      </div>
    );
  }
  if (!line) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500"
      >
        <span className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
          <FileX className="w-6 h-6 text-slate-400" />
        </span>
        لا توجد بيانات للخط رقم {id}
      </div>
    );
  }

  const fields = [
    { label: "رقم الخط", value: line.number, icon: PhoneCall },
    { label: "اسم العميل", value: line.customer_name, icon: User },
    { label: "رقم الحساب", value: line.account_no, icon: Hash },
    { label: "الشبكة", value: line.provider_name, icon: Network },
    { label: "المنفذ", value: line.almanafiz, icon: Plug },
    { label: "البائع", value: line.agent_name, icon: Briefcase },
    { label: "القسم", value: line.department, icon: Building2 },
    { label: "الجروب", value: line.group_name, icon: ListTree },
    { label: "التاريخ", value: line.customer_date_real, icon: Calendar },
    { label: "السعر", value: line.total_price, icon: Banknote },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <PhoneCall className="w-6 h-6 text-white" />
          </span>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              بيانات الخط
            </h1>
            <p className="text-base text-blue-100 font-medium mt-1">
              رقم {line.number}
            </p>
          </div>
        </div>

        <Link
          href="/lines"
          className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition text-white px-5 py-2.5 rounded-xl font-medium text-sm border border-white/10"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Link>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div
                key={field.label}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-blue-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-400">{field.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">
                    {field.value || "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-5 -mx-6 -mt-6 px-6 py-4 bg-slate-900 rounded-t-2xl">
          <History className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">سجل التعديلات</h2>
        </div>

        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
            <span className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-300" />
            </span>
            <span className="text-sm">لا يوجد تعديلات</span>
          </div>
        )}

        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="border border-slate-100 rounded-xl p-4 bg-slate-50/40"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 font-bold text-blue-600 text-base">
                  <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
                    {item.user_name?.charAt(0) || "?"}
                  </span>
                  {item.user_name}
                </span>
                <span className="text-sm text-slate-400">
                  {new Date(item.created_at).toLocaleString("ar-EG")}
                </span>
              </div>

              <div className="space-y-2">
                {item.old_data?.customer_name && (
                  <div className="text-base text-slate-600 bg-white rounded-lg border border-slate-100 p-3">
                    <span className="text-slate-500">تم تعديل اسم العميل</span>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="text-red-500 line-through font-medium">
                        {item.old_data.customer_name.old}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-300 rotate-180" />
                      <span className="font-bold text-green-600">
                        {item.old_data.customer_name.new}
                      </span>
                    </div>
                  </div>
                )}

                {item.old_data?.almanafiz && (
                  <div className="text-base text-slate-600 bg-white rounded-lg border border-slate-100 p-3">
                    <span className="text-slate-500">تم تعديل المنفذ</span>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="text-red-500 line-through font-medium">
                        {item.old_data.almanafiz.old}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-300 rotate-180" />
                      <span className="font-bold text-green-600">
                        {item.old_data.almanafiz.new}
                      </span>
                    </div>
                  </div>
                )}

                {item.old_data?.customer_date_real && (
                  <div className="text-base text-slate-600 bg-white rounded-lg border border-slate-100 p-3">
                    <span className="text-slate-500">تم تعديل التاريخ</span>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="text-red-500 line-through font-medium">
                        {item.old_data.customer_date_real.old}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-300 rotate-180" />
                      <span className="font-bold text-green-600">
                        {item.old_data.customer_date_real.new}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}