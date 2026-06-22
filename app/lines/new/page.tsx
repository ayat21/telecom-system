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
  MapPin,
  IdCard,
  ScanLine,
  ImagePlus,
  Upload,
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
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [callsPackages, setCallsPackages] = useState<any[]>([]);
  const [internetPackages, setInternetPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  const [form, setForm] = useState({
    number: "",
    account_no: "",
    customer_name: "",
    customer_date: "",
    serial_number: "",
    address: "",
    national_id: "",
    almanafiz: "",
    calls_package: "",
   provider_name: "",
    package_name: "",
    line_extension_name: "",
    calls_package_price:"",
    internet_package_price:"",
    line_extension_price:"",
    note: "",
    national_id_image:"",
    report_note: "",
    agent_name: "",
    department: "",
    group_name: "",
    total_price: "",
  });

  useEffect(() => {
    loadLookups();
  }, []);

  async function loadLookups() {
    const { data: p, error: pError } =
    await supabase.from("providers").select("*");

  const { data: a, error: aError } =
    await supabase.from("almanafiz").select("*");

  console.log("PROVIDERS", p);
  console.log("PROVIDERS ERROR", pError);

  console.log("ALMANAFIZ", a);
  console.log("ALMANAFIZ ERROR", aError);

  setProviders(p || []);
  setAlmanafizList(a || []);
  }

  async function handleProviderChange(providers: string) {
    const { data: calls } = await supabase
      .from("calls_packages")
      .select("*")
      .eq("provider_name", providers);

    const { data: internet } = await supabase
      .from("internet_packages")
      .select("*")
      .eq("provider_name", providers);

    const { data: ext } = await supabase
      .from("line_extensions")
      .select("*")
      .eq("provider_name", providers);

    setCallsPackages(calls || []);
    setInternetPackages(internet || []);
    setServices(ext || []);

    setForm((prev) => ({
      ...prev,
      provider_name: providers,
      // تصفير الباقات المختارة لإن الباقات بتختلف باختلاف الشبكة
      calls_package: "",
      calls_package_price: "",
      package_name: "",
      internet_package_price: "",
      line_extension_name: "",
      line_extension_price: "",
    }));
  }

  useEffect(() => {
    const total =
      Number(form.calls_package_price || 0) +
      Number(form.internet_package_price || 0) +
      Number(form.line_extension_price || 0);

    setForm((prev) => ({
      ...prev,
      total_price: String(total),
    }));
  }, [
    form.calls_package_price,
    form.internet_package_price,
    form.line_extension_price,
  ]);

  async function save() {
    if (!form.number) {
      alert("رقم الخط مطلوب");
      return;
    }

    setLoading(true);

  const { error } = await supabase
  .from("lines")
  .insert({
    number: form.number,
    account_no: form.account_no,
    customer_name: form.customer_name,
    customer_date: form.customer_date,
    serial_number: form.serial_number,
    address: form.address,
    national_id: form.national_id,
    national_id_image: form.national_id_image,

    provider_name: form.provider_name,
    almanafiz: form.almanafiz,

    calls_package: form.calls_package,
    calls_package_price: Number(form.calls_package_price || 0),

    package_name:
      form.package_name,
    internet_package_price: Number(
      form.internet_package_price || 0
    ),

    line_extension_name:
      form.line_extension_name,
    line_extension_price: Number(
      form.line_extension_price || 0
    ),

    note: form.note,
    report_note: form.report_note,

    agent_name: form.agent_name,
    department: form.department,
    group_name: form.group_name,

    total_price: Number(
      form.total_price || 0
    ),
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
      serial_number: "",
      address: "",
      national_id_image:"",
      national_id: "",
      almanafiz: "",
      calls_package: "",
      package_name: "",
      line_extension_name: "",
  provider_name: "",
      note: "",
       calls_package_price:"",
    internet_package_price:"",
    line_extension_price:"",
      report_note: "",
      agent_name: "",
      department: "",
      group_name: "",
      total_price: "",
    });
    setImageFile(null);
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
              label="سيريال نمبر"
              icon={ScanLine}
              value={form.serial_number}
              onChange={(v) => update("serial_number", v)}
            />
            <Field
              label="العنوان"
              icon={MapPin}
              value={form.address}
              onChange={(v) => update("address", v)}
            />
            <Field
              label="الرقم القومى"
              icon={IdCard}
              value={form.national_id}
              onChange={(v) => update("national_id", v)}
            />
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                تاريخ العميل
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={form.customer_date}
                  onChange={(e) => update("customer_date", e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                صورة بطاقة العميل
              </label>
              <label className="w-full border border-slate-200 bg-slate-50 text-slate-500 pr-10 pl-3 py-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition relative text-sm">
                <ImagePlus className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <span className="truncate">
                 {imageFile ? imageFile.name : "اختر صورة البطاقة"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    setImageFile(e.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
          </div>
        </div>

        {/* Network info */}
        <div className="bg-white rounded-2xl shadow-sm border slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Network className="w-3.5 h-3.5" />
                الشبكة
              </label>
              <select
                value={form.provider_name}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
              >
                <option value="">اختر الشبكة</option>
                {providers.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                    
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Plug className="w-3.5 h-3.5" />
                المنفذ
              </label>
              <select
                value={form.almanafiz}
                onChange={(e) => update("almanafiz", e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
              >
                <option value="">اختر المنفذ</option>
                {almanafizList.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والإضافات" icon={Package} />
          {!form.package_name && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
              اختاري الشبكة الأول عشان الباقات المتاحة تظهر هنا
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" />
                باقة المكالمات
              </label>
              <select
                value={form.calls_package}
                onChange={(e) => {
                  const selected = callsPackages.find(
                    (x) => x.package_name === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                    calls_package: selected?.package_name || "",
                    calls_package_price: String(selected?.price || ""),
                  }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
              >
                <option value="">باقة المكالمات</option>
                {callsPackages.map((item) => (
                  <option key={item.id} value={item.package_name}>
                    {item.package_name}
                 
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" />
                سعر باقة المكالمات
              </label>
              <input              
                  value={form.calls_package_price}
  onChange={(e) =>
    update("calls_package_price", e.target.value)
  }
  className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium"      />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" />
                باقة الإنترنت
              </label>
              <select
                value={form.package_name}
                onChange={(e) => {
                  const selected = internetPackages.find(
                    (x) => x.package_name === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                   package_name: selected?.package_name || "",
                    internet_package_price: String(selected?.price || ""),
                  }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
              >
                <option value="">باقة الإنترنت</option>
                {internetPackages.map((item) => (
                  <option key={item.id} value={item.package_name}>
                    {item.package_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" />
                سعر باقة الإنترنت
              </label>
              <input
                value={form.internet_package_price}
  onChange={(e) =>
    update("internet_package_price", e.target.value)
  }
  className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" />
                الإضافة
              </label>
              <select
                value={form.line_extension_name}
                onChange={(e) => {
                  const selected = services.find(
                    (x) => x.extension_name === e.target.value
                  );
                  setForm((prev) => ({
                    ...prev,
                    line_extension_name: selected?.extension_name || "",
                    line_extension_price: String(selected?.price || ""),
                  }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm"
              >
                <option value="">الإضافة</option>
                {services.map((item) => (
                  <option key={item.id} value={item.extension_name}>
                    {item.extension_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" />
                سعر الإضافة
              </label>
              <input
                
                  value={form.line_extension_price}
  onChange={(e) =>
    update("line_extension_price", e.target.value)
  }
  className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium"
              />
            </div>
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
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" />
                إجمالي السعر
              </label>
              <input
                disabled
                value={form.total_price}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
              />
            </div>
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




