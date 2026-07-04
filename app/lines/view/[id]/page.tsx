"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Eye, ArrowRight, User, Network, Package, Tag,
  StickyNote, Hash, Calendar, Plug, Briefcase,
  Building2, ListTree, Banknote, CreditCard, CheckCircle2, XCircle,
} from "lucide-react";

function SectionTitle({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </span>
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="w-3.5 h-3.5" />{label}
      </label>
      <p className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 min-h-[40px]">
        {value || "—"}
      </p>
    </div>
  );
}

export default function ViewLine({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [line, setLine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const p = await params;
      const { data } = await supabase
        .from("lines")
        .select(`
          *,
          providers(name),
          almanafiz(name),
          agents(name),
          departments(name),
          groups(name),
          clients(name, national_id, address),
          accounts(account_no, account_name),
          line_statuses(name),
          calls_packages(package_name),
          internet_packages(package_name),
          line_extensions(extension_name)
        `)
        .eq("id", p.id)
        .single();
      setLine(data);
      setLoading(false);
    }
    load();
  }, [params]);

  if (loading) return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      جاري التحميل...
    </div>
  );

  if (!line) return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      الخط غير موجود
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">عرض بيانات الخط</h1>
              <p className="text-sm text-blue-100 mt-0.5">رقم الخط: {line.number}</p>
            </div>
          </div>
          <button onClick={() => router.back()}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition text-white px-4 py-2.5 rounded-xl font-medium text-sm border border-white/10">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
        </div>

        {/* بيانات الخط */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الخط" icon={Hash} />
          <div className="grid md:grid-cols-2 gap-4">
            <InfoRow label="رقم الخط" value={line.number} icon={Hash} />
            <InfoRow label="المنفذ" value={line.almanafiz?.name} icon={Plug} />
            <InfoRow label="سيريال نمبر" value={line.serial_number} icon={Hash} />
            <InfoRow label="تاريخ العميل" value={line.customer_date_real} icon={Calendar} />
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                الرقم على شريحة
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                {line.has_sim
                  ? <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">نعم، على شريحة</span></>
                  : <><XCircle className="w-4 h-4 text-slate-400" /><span className="text-sm font-medium text-slate-500">لا</span></>
                }
              </div>
            </div>
          </div>
        </div>

        {/* العميل */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="العميل" icon={User} />
          <div className="grid md:grid-cols-2 gap-4">
            <InfoRow label="اسم العميل" value={line.clients?.name} icon={User} />
            <InfoRow label="الرقم القومي" value={line.clients?.national_id} icon={Hash} />
            <InfoRow label="العنوان" value={line.clients?.address} icon={Building2} />
          </div>
        </div>

        {/* بيانات الشبكة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <InfoRow label="الشبكة" value={line.providers?.name} icon={Network} />
            <InfoRow label="الأكونت"
              value={line.accounts ? `${line.accounts.account_no}${line.accounts.account_name ? ` — ${line.accounts.account_name}` : ""}` : null}
              icon={CreditCard} />
            <InfoRow label="القسم" value={line.departments?.name} icon={Building2} />
            <InfoRow label="الجروب" value={line.groups?.name} icon={ListTree} />
            <InfoRow label="المندوب" value={line.agents?.name} icon={Briefcase} />
            <InfoRow label="حالة الخط" value={line.line_statuses?.name} icon={Tag} />
          </div>
        </div>

        {/* الباقات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والخدمات" icon={Package} />
          <div className="grid md:grid-cols-2 gap-4">
            <InfoRow label="باقة المكالمات" value={line.calls_packages?.package_name} icon={Package} />
            <InfoRow label="سعر باقة المكالمات" value={line.calls_package_price} icon={Banknote} />
            <InfoRow label="باقة الإنترنت" value={line.internet_packages?.package_name} icon={Package} />
            <InfoRow label="سعر باقة الإنترنت" value={line.internet_package_price} icon={Banknote} />
            <InfoRow label="الإضافة" value={line.line_extensions?.extension_name} icon={Package} />
            <InfoRow label="سعر الإضافة" value={line.line_extension_price} icon={Banknote} />
          </div>
          <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
              <Tag className="w-4 h-4" /> إجمالي السعر
            </span>
            <span className="text-2xl font-bold text-blue-700">{line.total_price || 0}</span>
          </div>
        </div>

        {/* ملاحظات */}
        {(line.note || line.report_note) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <SectionTitle title="ملاحظات" icon={StickyNote} />
            <div className="space-y-4">
              {line.note && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">ملاحظات</label>
                  <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                    {line.note}
                  </p>
                </div>
              )}
              {line.report_note && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">ملاحظات التقرير</label>
                  <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
                    {line.report_note}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}