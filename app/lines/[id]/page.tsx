"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  ArrowRight,
  User,
  Network,
  Package,
  Tag,
  StickyNote,
  Hash,
  Calendar,
  Plug,
  Briefcase,
  Building2,
  ListTree,
  Banknote,
  History,
  Save,
  MapPin,
  IdCard,
  ScanLine,
  ImagePlus,
  Upload,
} from "lucide-react";

// ============================================================
// مكوّنات شكل موحّدة (بدون أي منطق إضافي)
// ============================================================

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

function FieldWrap({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-slate-200 bg-white text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm";
const disabledInputClass =
  "w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium";

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
  const [originalLine, setOriginalLine] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [nationalId, setNationalId] = useState("");
  const [address, setAddress] = useState("");
  const [nationalIdImage, setNationalIdImage] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

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

        await handleProviderChange(data.provider_name);
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
    const { data: p } = await supabase.from("providers").select("*");

    const { data: a } = await supabase.from("almanafiz").select("*");

    const { data: d } = await supabase.from("departments").select("*");

    const { data: g } = await supabase.from("groups").select("*");

    setProviders(p || []);

    setAlmanafizList(a || []);

    setDepartments(d || []);

    setGroups(g || []);
  }

  async function handleProviderChange(provider: string) {
    const { data: calls } = await supabase
      .from("calls_packages")
      .select("*")
      .eq("provider_name", provider);

    const { data: internet } = await supabase
      .from("internet_packages")
      .select("*")
      .eq("provider_name", provider);

    const { data: ext } = await supabase
      .from("line_extensions")
      .select("*")
      .eq("provider_name", provider);

    setCallsPackages(calls || []);

    setInternetPackages(internet || []);

    setServices(ext || []);

    setLine((prev: any) => ({
      ...prev,

      provider_name: provider,
    }));
  }
  const router = useRouter();

  async function loadHistory(lineId: string) {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("table_name", "lines")
      .eq("record_id", Number(lineId))
      .order("created_at", {
        ascending: false,
      });

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

    if (originalLine.customer_date_real !== line.customer_date_real) {
      changes.customer_date_real = {
        old: originalLine.customer_date_real,
        new: line.customer_date_real,
      };
    }
    if (Object.keys(changes).length > 0) {
      await supabase.from("audit_logs").insert({
        user_name: localStorage.getItem("full_name") || "Unknown",

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
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400"
      >
        جاري التحميل...
      </div>
    );
  }
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Pencil className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                تعديل بيانات الخط
              </h1>
              <p className="text-sm text-blue-100 mt-0.5">
                رقم الخط: {line.number}
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
            <FieldWrap label="رقم الحساب" icon={Hash}>
              <input
                placeholder="رقم الحساب"
                className={inputClass}
                value={line.account_no || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    account_no: e.target.value,
                  })
                }
              />
            </FieldWrap>

            <FieldWrap label="اسم العميل" icon={User}>
              <input
                placeholder="اسم العميل"
                className={inputClass}
                value={line.customer_name || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    customer_name: e.target.value,
                  })
                }
              />
            </FieldWrap>
            <FieldWrap label="سيريال نمبر" icon={ScanLine}>
              <input
                placeholder="سيريال نمبر"
                className={inputClass}
                value={line.serial_number || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    serial_number: e.target.value,
                  })
                }
              />
            </FieldWrap>
            <FieldWrap label="العنوان" icon={MapPin}>
              <input
                placeholder="العنوان"
                className={inputClass}
                value={line.address || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    address: e.target.value,
                  })
                }
              />
            </FieldWrap>
            <FieldWrap label="الرفم القومى" icon={IdCard}>
              <input
                placeholder="الرقم القومى"
                className={inputClass}
                value={line.national_id || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    national_id: e.target.value,
                  })
                }
              />
            </FieldWrap>

            <FieldWrap label="تاريخ بيع الخط" icon={Calendar}>
              <input
                type="date"
                className={inputClass}
                value={line.customer_date_real || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    customer_date_real: e.target.value,
                  })
                }
              />
            </FieldWrap>
            <FieldWrap label="صورة بطاقة العميل" icon={ImagePlus}>
              <label
                className={`${inputClass} flex items-center gap-2 cursor-pointer text-slate-500 hover:bg-slate-50 transition`}
              >
                <Upload className="w-4 h-4 text-slate-400 shrink-0" />
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
            </FieldWrap>

            <FieldWrap label="اسم المندوب" icon={Briefcase}>
              <input
                placeholder="اسم المندوب"
                className={inputClass}
                value={line.agent_name || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    agent_name: e.target.value,
                  })
                }
              />
            </FieldWrap>
          </div>
        </div>

        {/* Network info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="الشبكة" icon={Network}>
              <select
                className={inputClass}
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
            </FieldWrap>

            <FieldWrap label="المنفذ" icon={Plug}>
              <select
                className={inputClass}
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
            </FieldWrap>

            <FieldWrap label="القسم" icon={Building2}>
              <input
                placeholder="القسم"
                className={inputClass}
                value={line.department || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    department: e.target.value,
                  })
                }
              />
            </FieldWrap>

            <FieldWrap label="الجروب" icon={ListTree}>
              <input
                placeholder="الجروب"
                className={inputClass}
                value={line.group_name || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    group_name: e.target.value,
                  })
                }
              />
            </FieldWrap>
          </div>
        </div>

        {/* Packages */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والخدمات" icon={Package} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="باقة المكالمات" icon={Package}>
              <select
                className={inputClass}
                value={line.calls_package || ""}
                onChange={(e) => {
                  const selected = callsPackages.find(
                    (x) => x.package_name === e.target.value
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
            </FieldWrap>

            <FieldWrap label="سعر باقة المكالمات" icon={Banknote}>
  <input
    className={inputClass}
    value={line.calls_package_price || ""}
    onChange={(e) =>
      setLine({
        ...line,
        calls_package_price: e.target.value,
      })
    }
  />
</FieldWrap>

            <FieldWrap label="باقة النت" icon={Package}>
              <select
                className={inputClass}
                value={line.internet_package_name || ""}
                onChange={(e) => {
                  const selected = internetPackages.find(
                    (x) => x.package_name === e.target.value
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
            </FieldWrap>

            <FieldWrap label="سعر باقة النت" icon={Banknote}>
             <input
    className={inputClass}
    value={line.internet_package_price || ""}
    onChange={(e) =>
      setLine({
        ...line,
        internet_package_price: e.target.value,
      })
    }
  />
            </FieldWrap>

            <FieldWrap label="الخدمة" icon={Package}>
              <select
                className={inputClass}
                value={line.line_extension_name || ""}
                onChange={(e) => {
                  const selected = services.find(
                    (x) => x.extension_name === e.target.value
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
            </FieldWrap>

            <FieldWrap label="سعر الخدمة" icon={Banknote}>
              <input
    className={inputClass}
    value={line.line_extension_price || ""}
    onChange={(e) =>
      setLine({
        ...line,
        line_extension_price: e.target.value,
      })
    }
  />
            </FieldWrap>
          </div>

          <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
              <Tag className="w-4 h-4" />
              إجمالي السعر
            </span>
            <span className="text-lg font-bold text-blue-700">
              {line.total_price || 0}
            </span>
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
                rows={4}
                placeholder="ملاحظات"
                className={inputClass}
                value={line.note || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    note: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                ملاحظات التقرير
              </label>
              <textarea
                rows={4}
                placeholder="ملاحظات التقرير"
                className={inputClass}
                value={line.report_note || ""}
                onChange={(e) =>
                  setLine({
                    ...line,

                    report_note: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={save}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-8 py-3 rounded-xl shadow-sm font-medium"
          >
            <Save className="w-4 h-4" />
            حفظ التعديلات
          </button>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5 -mx-6 -mt-6 px-6 py-4 bg-gradient-to-l from-blue-600 to-blue-500 rounded-t-2xl">
            <History className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">سجل التعديلات</h2>
          </div>

          {history.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-sm">
              لا يوجد تعديلات
            </div>
          )}

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="border border-slate-100 rounded-xl p-4 bg-slate-50/40"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 font-bold text-blue-600 text-sm">
                    <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs">
                      {item.user_name?.charAt(0) || "?"}
                    </span>
                    {item.user_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>

                <div className="space-y-2">
                  {item.old_data?.customer_name && (
                    <div className="text-sm text-slate-600 bg-white rounded-lg border border-slate-100 p-2.5">
                      <span className="text-slate-500">
                        تم تعديل اسم العميل
                      </span>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-red-500 line-through">
                          {item.old_data.customer_name.old}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />
                        <span className="font-bold text-green-600">
                          {item.old_data.customer_name.new}
                        </span>
                      </div>
                    </div>
                  )}

                  {item.old_data?.almanafiz && (
                    <div className="text-sm text-slate-600 bg-white rounded-lg border border-slate-100 p-2.5">
                      <span className="text-slate-500">تم تعديل المنفذ</span>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-red-500 line-through">
                          {item.old_data.almanafiz.old}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />
                        <span className="font-bold text-green-600">
                          {item.old_data.almanafiz.new}
                        </span>
                      </div>
                    </div>
                  )}

                  {item.old_data?.customer_date_real && (
                    <div className="text-sm text-slate-600 bg-white rounded-lg border border-slate-100 p-2.5">
                      <span className="text-slate-500">تم تعديل التاريخ</span>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-red-500 line-through">
                          {item.old_data.customer_date_real.old}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 rotate-180" />
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
    </div>
  );
}