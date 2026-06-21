"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  ArrowRight,
  User,
  Network,
  Package,
  Tag,
  StickyNote,
  Loader2,
  Hash,
  Calendar,
  Plug,
  Briefcase,
  Building2,
  ListTree,
  Banknote,
} from "lucide-react";

// ============================================================
// مكوّن حقل إدخال موحد الشكل (شكل فقط، بدون أي منطق إضافي)
// ============================================================

function Field({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          placeholder={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
        />
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </span>
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
    </div>
  );
}

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
    const role = localStorage.getItem("role");

    if (role !== "admin" && role !== "super_admin") {
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
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <PlusCircle className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                إضافة خط جديد
              </h1>
              <p className="text-sm text-blue-100 mt-0.5">
                املأ البيانات التالية لإضافة خط جديد للنظام
              </p>
            </div>
          </div>

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition text-white px-4 py-2.5 rounded-xl font-medium text-sm border border-white/10"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات العميل" icon={User} />
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="رقم الخط"
              icon={Hash}
              value={form.number}
              onChange={(v) => update("number", v)}
            />
            <Field
              label="رقم الحساب"
              icon={Hash}
              value={form.account_no}
              onChange={(v) => update("account_no", v)}
            />
            <Field
              label="اسم العميل"
              icon={User}
              value={form.customer_name}
              onChange={(v) => update("customer_name", v)}
            />
            <Field
              label="تاريخ العميل"
              icon={Calendar}
              value={form.customer_date}
              onChange={(v) => update("customer_date", v)}
            />
          </div>
        </div>

        {/* Network info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="المنفذ"
              icon={Plug}
              value={form.almanafiz}
              onChange={(v) => update("almanafiz", v)}
            />
            <Field
              label="الشبكة"
              icon={Network}
              value={form.provider_name}
              onChange={(v) => update("provider_name", v)}
            />
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والإضافات" icon={Package} />
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="باقة المكالمات"
              icon={Package}
              value={form.calls_package}
              onChange={(v) => update("calls_package", v)}
            />
            <Field
              label="سعر باقة المكالمات"
              icon={Banknote}
              value={form.calls_package_price}
              onChange={(v) => update("calls_package_price", v)}
            />
            <Field
              label="باقة الإنترنت"
              icon={Package}
              value={form.internet_package_name}
              onChange={(v) => update("internet_package_name", v)}
            />
            <Field
              label="سعر باقة الإنترنت"
              icon={Banknote}
              value={form.internet_package_price}
              onChange={(v) => update("internet_package_price", v)}
            />
            <Field
              label="الإضافة"
              icon={Package}
              value={form.line_extension_name}
              onChange={(v) => update("line_extension_name", v)}
            />
            <Field
              label="سعر الإضافة"
              icon={Banknote}
              value={form.line_extension_price}
              onChange={(v) => update("line_extension_price", v)}
            />
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="التصنيف والسعر الإجمالي" icon={Tag} />
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="المندوب"
              icon={Briefcase}
              value={form.agent_name}
              onChange={(v) => update("agent_name", v)}
            />
            <Field
              label="القسم"
              icon={Building2}
              value={form.department}
              onChange={(v) => update("department", v)}
            />
            <Field
              label="الجروب"
              icon={ListTree}
              value={form.group_name}
              onChange={(v) => update("group_name", v)}
            />
            <Field
              label="إجمالي السعر"
              icon={Banknote}
              value={form.total_price}
              onChange={(v) => update("total_price", v)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="ملاحظات" icon={StickyNote} />
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                ملاحظات
              </label>
              <textarea
                placeholder="ملاحظات"
                value={form.note}
                onChange={(e) => update("note", e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                ملاحظات التقرير
              </label>
              <textarea
                placeholder="ملاحظات التقرير"
                value={form.report_note}
                onChange={(e) => update("report_note", e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={save}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-medium shadow-sm transition"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              حفظ الخط
            </>
          )}
        </button>
      </div>
    </div>
  );
}