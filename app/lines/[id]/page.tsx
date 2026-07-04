"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Pencil, ArrowRight, User, Network, Package, Tag,
  StickyNote, Loader2, Hash, Calendar, Plug, Briefcase,
  Building2, ListTree, Banknote, History, Save,
  ScanLine, ImagePlus, Upload, CreditCard,
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

function FieldWrap({ label, icon: Icon, children }: {
  label: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        <Icon className="w-3.5 h-3.5" />{label}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full border border-slate-200 bg-white text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm";
const readonlyClass = "w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm cursor-not-allowed";

export default function EditLine({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [line, setLine] = useState<any>(null);
  const [id, setId] = useState("");
  const [originalLine, setOriginalLine] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [lineStatuses, setLineStatuses] = useState<any[]>([]);
  const [callsPackages, setCallsPackages] = useState<any[]>([]);
  const [internetPackages, setInternetPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [groupName, setGroupName] = useState("");

  // ─── Init ─────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const p = await params;
      setId(p.id);
      const { data } = await supabase.from("lines").select("*").eq("id", p.id).single();
      if (data) {
        setLine(data);
        setOriginalLine(data);
        await loadHistory(p.id);
        if (data.provider_id) await loadPackagesStatusesAccounts(data.provider_id);
        if (data.almanafiz_id) await loadAlmanafizDetails(data.almanafiz_id);
      }
     
console.log(data);
    }
    init();
  }, [params]);
 

  // ─── Load lookups ─────────────────────────────────────────
  useEffect(() => {
    async function loadLookups() {
      const [{ data: p }, { data: a }, { data: ag }, { data: cl }] = await Promise.all([
        supabase.from("providers").select("*"),
        supabase.from("almanafiz").select("*, groups(id, name, departments(id, name))"),
        supabase.from("agents").select("*").eq("is_active", true),
        supabase.from("clients").select("id, name, national_id").order("name"),
      ]);
      setProviders(p || []);
      setAlmanafizList(a || []);
      setAgentsList(ag || []);
      setClientsList(cl || []);
    }
    loadLookups();
  }, []);

  // ─── Auto total ───────────────────────────────────────────
  useEffect(() => {
    if (!line) return;
    const total =
      Number(line.calls_package_price || 0) +
      Number(line.internet_package_price || 0) +
      Number(line.line_extension_price || 0);
    setLine((prev: any) => ({ ...prev, total_price: total }));
  }, [line?.calls_package_price, line?.internet_package_price, line?.line_extension_price]);

  async function loadPackagesStatusesAccounts(providerId: number) {
    const [{ data: calls }, { data: internet }, { data: ext }, { data: statuses }, { data: acc }] =
      await Promise.all([
        supabase.from("calls_packages").select("*").eq("provider_id", providerId),
        supabase.from("internet_packages").select("*").eq("provider_id", providerId),
        supabase.from("line_extensions").select("*").eq("provider_id", providerId),
        supabase.from("line_statuses").select("*").eq("provider_id", providerId),
        supabase.from("accounts").select("id, account_no, account_name").eq("provider_id", providerId).order("account_no"),
      ]);
    setCallsPackages(calls || []);
    setInternetPackages(internet || []);
    setServices(ext || []);
    setLineStatuses(statuses || []);
    setAccountsList(acc || []);
  }

  async function loadAlmanafizDetails(almanafizId: number) {
    const found = almanafizList.find((a) => a.id === almanafizId);
    if (found) {
      setGroupName(found.groups?.name || "");
      setDepartmentName(found.groups?.departments?.name || "");
    } else {
      const { data } = await supabase
        .from("almanafiz").select("*, groups(id, name, departments(id, name))")
        .eq("id", almanafizId).single();
      if (data) {
        setGroupName(data.groups?.name || "");
        setDepartmentName(data.groups?.departments?.name || "");
      }
    }
  }

  async function handleProviderChange(providerId: string) {
    await loadPackagesStatusesAccounts(Number(providerId));
    setLine((prev: any) => ({
      ...prev,
      provider_id: Number(providerId),
      account_id: null,
      calls_package_id: null,
      calls_package_price: 0,
      internet_package_id: null,
      internet_package_price: 0,
      line_extension_id: null,
      line_extension_price: 0,
      line_status_id: null,
    }));
  }

  async function handleAlmanafizChange(almanafizId: string) {
    const selected = almanafizList.find((a) => a.id === Number(almanafizId));
    setGroupName(selected?.groups?.name || "");
    setDepartmentName(selected?.groups?.departments?.name || "");
    setLine((prev: any) => ({
      ...prev,
      almanafiz_id: Number(almanafizId),
      group_id: selected?.groups?.id || null,
      department_id: selected?.groups?.departments?.id || null,
    }));
  }

  // ─── Load history من audit_logs ───────────────────────────
async function loadHistory(lineId: string) {
  console.log("lineId =", lineId);

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("table_name", "lines")
    .order("created_at", { ascending: false });

  console.log("all audit_logs =", data);
  console.log("error =", error);

  const filtered = (data || []).filter(
    (item) => String(item.record_id) === String(lineId)
  );

  console.log("filtered =", filtered);
  setHistoryList(filtered);
}

  // ─── Save ─────────────────────────────────────────────────
  async function save() {
    const changes: any = {};

    if (Number(originalLine.client_id) !== Number(line.client_id))
      changes.client = {
        old: clientsList.find((c) => c.id === Number(originalLine.client_id))?.name || "—",
        new: clientsList.find((c) => c.id === Number(line.client_id))?.name || "—",
      };
    if (Number(originalLine.provider_id) !== Number(line.provider_id))
      changes.provider = {
        old: providers.find((p) => p.id === Number(originalLine.provider_id))?.name || "—",
        new: providers.find((p) => p.id === Number(line.provider_id))?.name || "—",
      };
    if (Number(originalLine.almanafiz_id) !== Number(line.almanafiz_id))
      changes.almanafiz = {
        old: almanafizList.find((a) => a.id === Number(originalLine.almanafiz_id))?.name || "—",
        new: almanafizList.find((a) => a.id === Number(line.almanafiz_id))?.name || "—",
      };
    if (Number(originalLine.agent_id) !== Number(line.agent_id))
      changes.agent = {
        old: agentsList.find((a) => a.id === Number(originalLine.agent_id))?.name || "—",
        new: agentsList.find((a) => a.id === Number(line.agent_id))?.name || "—",
      };
    if (Number(originalLine.account_id) !== Number(line.account_id))
      changes.account = {
        old: accountsList.find((a) => a.id === Number(originalLine.account_id))?.account_no || "—",
        new: accountsList.find((a) => a.id === Number(line.account_id))?.account_no || "—",
      };
    if (Number(originalLine.line_status_id) !== Number(line.line_status_id))
      changes.line_status = {
        old: lineStatuses.find((s) => s.id === Number(originalLine.line_status_id))?.name || "—",
        new: lineStatuses.find((s) => s.id === Number(line.line_status_id))?.name || "—",
      };
    if (Number(originalLine.calls_package_id) !== Number(line.calls_package_id))
      changes.calls_package = {
        old: callsPackages.find((p) => p.id === Number(originalLine.calls_package_id))?.package_name || "—",
        new: callsPackages.find((p) => p.id === Number(line.calls_package_id))?.package_name || "—",
      };
    if (Number(originalLine.internet_package_id) !== Number(line.internet_package_id))
      changes.internet_package = {
        old: internetPackages.find((p) => p.id === Number(originalLine.internet_package_id))?.package_name || "—",
        new: internetPackages.find((p) => p.id === Number(line.internet_package_id))?.package_name || "—",
      };
    if (Number(originalLine.line_extension_id) !== Number(line.line_extension_id))
      changes.line_extension = {
        old: services.find((s) => s.id === Number(originalLine.line_extension_id))?.extension_name || "—",
        new: services.find((s) => s.id === Number(line.line_extension_id))?.extension_name || "—",
      };
    if (Number(originalLine.total_price) !== Number(line.total_price))
      changes.total_price = { old: originalLine.total_price, new: line.total_price };
    if (Boolean(originalLine.has_sim) !== Boolean(line.has_sim))
      changes.has_sim = {
        old: originalLine.has_sim ? "على شريحة" : "مش على شريحة",
        new: line.has_sim ? "على شريحة" : "مش على شريحة",
      };
    if (originalLine.serial_number !== line.serial_number)
      changes.serial_number = { old: originalLine.serial_number || "—", new: line.serial_number || "—" };
    if (originalLine.customer_date_real !== line.customer_date_real)
      changes.customer_date = { old: originalLine.customer_date_real || "—", new: line.customer_date_real || "—" };
    if (originalLine.note !== line.note)
      changes.note = { old: originalLine.note || "—", new: line.note || "—" };
    if (originalLine.report_note !== line.report_note)
      changes.report_note = { old: originalLine.report_note || "—", new: line.report_note || "—" };

    // audit_logs
    if (Object.keys(changes).length > 0) {
      await supabase.from("audit_logs").insert({
        user_name: localStorage.getItem("full_name") || "Unknown",
        action_type: "UPDATE",
        table_name: "lines",
        record_id: String(id),
        old_data: changes,
      });
    }

    // update lines
    const { error } = await supabase.from("lines").update({
      customer_date_real: line.customer_date_real,
      serial_number: line.serial_number,
      note: line.note,
      report_note: line.report_note,
      has_sim: Boolean(line.has_sim),
      client_id:           line.client_id           ? Number(line.client_id)           : null,
      provider_id:         line.provider_id         ? Number(line.provider_id)         : null,
      account_id:          line.account_id          ? Number(line.account_id)          : null,
      almanafiz_id:        line.almanafiz_id        ? Number(line.almanafiz_id)        : null,
      department_id:       line.department_id       ? Number(line.department_id)       : null,
      group_id:            line.group_id            ? Number(line.group_id)            : null,
      agent_id:            line.agent_id            ? Number(line.agent_id)            : null,
      line_status_id:      line.line_status_id      ? Number(line.line_status_id)      : null,
      calls_package_id:    line.calls_package_id    ? Number(line.calls_package_id)    : null,
      internet_package_id: line.internet_package_id ? Number(line.internet_package_id) : null,
      line_extension_id:   line.line_extension_id   ? Number(line.line_extension_id)   : null,
      calls_package_price:    Number(line.calls_package_price || 0),
      internet_package_price: Number(line.internet_package_price || 0),
      line_extension_price:   Number(line.line_extension_price || 0),
      total_price:            Number(line.total_price || 0),
    }).eq("id", id);

    if (error) { alert(error.message); return; }

    alert("تم حفظ التعديلات");
    await loadHistory(id);
    setOriginalLine(line);
  }

  if (!line) return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      جاري التحميل...
    </div>
  );

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
              <h1 className="text-2xl md:text-3xl font-bold text-white">تعديل بيانات الخط</h1>
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
            <FieldWrap label="رقم الخط" icon={Hash}>
              <input readOnly value={line.number} className={readonlyClass} />
            </FieldWrap>
            <FieldWrap label="المنفذ" icon={Plug}>
              <select className={inputClass} value={line.almanafiz_id || ""}
                onChange={(e) => handleAlmanafizChange(e.target.value)}>
                <option value="">اختر المنفذ</option>
                {almanafizList.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="سيريال نمبر" icon={ScanLine}>
              <input className={inputClass} value={line.serial_number || ""}
                onChange={(e) => setLine({ ...line, serial_number: e.target.value })}
                placeholder="سيريال نمبر" />
            </FieldWrap>
            <FieldWrap label="تاريخ العميل" icon={Calendar}>
              <input type="date" className={inputClass} value={line.customer_date_real || ""}
                onChange={(e) => setLine({ ...line, customer_date_real: e.target.value })} />
            </FieldWrap>
            <FieldWrap label="صورة بطاقة العميل" icon={ImagePlus}>
              <label className={`${inputClass} flex items-center gap-2 cursor-pointer text-slate-500 hover:bg-slate-50`}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{imageFile ? imageFile.name : "اختر صورة البطاقة"}</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </label>
            </FieldWrap>
          </div>
        </div>

        {/* العميل */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="العميل" icon={User} />
          <FieldWrap label="اسم العميل" icon={User}>
            <select className={inputClass} value={line.client_id || ""}
              onChange={(e) => setLine({ ...line, client_id: e.target.value })}>
              <option value="">اختر العميل</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FieldWrap>
        </div>

        {/* بيانات الشبكة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="الشبكة" icon={Network}>
              <select className={inputClass} value={line.provider_id || ""}
                onChange={(e) => handleProviderChange(e.target.value)}>
                <option value="">اختر الشبكة</option>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="الأكونت" icon={CreditCard}>
              <select className={inputClass} value={line.account_id || ""}
                disabled={!line.provider_id}
                onChange={(e) => setLine({ ...line, account_id: e.target.value })}>
                <option value="">{line.provider_id ? "اختر الأكونت" : "اختر الشبكة أولاً"}</option>
                {accountsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_no}{a.account_name ? ` — ${a.account_name}` : ""}
                  </option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="القسم" icon={Building2}>
              <input readOnly className={readonlyClass} value={departmentName} placeholder="يتعبأ أوتوماتيك" />
            </FieldWrap>
            <FieldWrap label="الجروب" icon={ListTree}>
              <input readOnly className={readonlyClass} value={groupName} placeholder="يتعبأ أوتوماتيك" />
            </FieldWrap>
            <FieldWrap label="المندوب" icon={Briefcase}>
              <select className={inputClass} value={line.agent_id || ""}
                onChange={(e) => setLine({ ...line, agent_id: e.target.value })}>
                <option value="">اختر المندوب</option>
                {agentsList.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="حالة الخط" icon={Tag}>
              <select className={inputClass} value={line.line_status_id || ""}
                disabled={!line.provider_id}
                onChange={(e) => setLine({ ...line, line_status_id: e.target.value })}>
                <option value="">{line.provider_id ? "اختر حالة الخط" : "اختر الشبكة أولاً"}</option>
                {lineStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FieldWrap>
          </div>
        </div>

        {/* الباقات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والخدمات" icon={Package} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="باقة المكالمات" icon={Package}>
              <select className={inputClass} value={line.calls_package_id || ""}
                onChange={(e) => {
                  const selected = callsPackages.find((x) => x.id === Number(e.target.value));
                  setLine({ ...line, calls_package_id: Number(e.target.value), calls_package_price: selected?.price || 0 });
                }}>
                <option value="">باقة المكالمات</option>
                {callsPackages.map((item) => (
                  <option key={item.id} value={item.id}>{item.package_name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="سعر باقة المكالمات" icon={Banknote}>
              <input className={inputClass} value={line.calls_package_price || ""}
                onChange={(e) => setLine({ ...line, calls_package_price: e.target.value })} />
            </FieldWrap>
            <FieldWrap label="باقة الإنترنت" icon={Package}>
              <select className={inputClass} value={line.internet_package_id || ""}
                onChange={(e) => {
                  const selected = internetPackages.find((x) => x.id === Number(e.target.value));
                  setLine({ ...line, internet_package_id: Number(e.target.value), internet_package_price: selected?.price || 0 });
                }}>
                <option value="">باقة الإنترنت</option>
                {internetPackages.map((item) => (
                  <option key={item.id} value={item.id}>{item.package_name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="سعر باقة الإنترنت" icon={Banknote}>
              <input className={inputClass} value={line.internet_package_price || ""}
                onChange={(e) => setLine({ ...line, internet_package_price: e.target.value })} />
            </FieldWrap>
            <FieldWrap label="الإضافة" icon={Package}>
              <select className={inputClass} value={line.line_extension_id || ""}
                onChange={(e) => {
                  const selected = services.find((x) => x.id === Number(e.target.value));
                  setLine({ ...line, line_extension_id: Number(e.target.value), line_extension_price: selected?.price || 0 });
                }}>
                <option value="">الإضافة</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>{item.extension_name}</option>
                ))}
              </select>
            </FieldWrap>
            <FieldWrap label="سعر الإضافة" icon={Banknote}>
              <input className={inputClass} value={line.line_extension_price || ""}
                onChange={(e) => setLine({ ...line, line_extension_price: e.target.value })} />
            </FieldWrap>
          </div>

          <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
              <Tag className="w-4 h-4" /> إجمالي السعر
            </span>
            <span className="text-lg font-bold text-blue-700">{line.total_price || 0}</span>
          </div>

          <div className="mt-3 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <input type="checkbox" id="has_sim_edit"
              checked={Boolean(line.has_sim)}
              onChange={(e) => setLine({ ...line, has_sim: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
            <label htmlFor="has_sim_edit" className="text-sm text-slate-700 cursor-pointer select-none">
              الرقم على شريحة
            </label>
          </div>
        </div>

        {/* ملاحظات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="ملاحظات" icon={StickyNote} />
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ملاحظات</label>
              <textarea rows={4} className={inputClass} value={line.note || ""}
                onChange={(e) => setLine({ ...line, note: e.target.value })} placeholder="ملاحظات" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ملاحظات التقرير</label>
              <textarea rows={4} className={inputClass} value={line.report_note || ""}
                onChange={(e) => setLine({ ...line, report_note: e.target.value })} placeholder="ملاحظات التقرير" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end mb-6">
          <button onClick={save}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-8 py-3 rounded-xl shadow-sm font-medium">
            <Save className="w-4 h-4" /> حفظ التعديلات
          </button>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-5 -mx-6 -mt-6 px-6 py-4 bg-gradient-to-l from-blue-600 to-blue-500 rounded-t-2xl">
            <History className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">سجل التعديلات</h2>
          </div>

          {historyList.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-sm">لا يوجد سجلات</div>
          )}

          <div className="space-y-3">
            {historyList.map((item) => (
              <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/40">

                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {item.user_name?.charAt(0) || "?"}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{item.user_name || "—"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.action_type === "DELETE"
                        ? "bg-red-50 text-red-700"
                        : "bg-blue-50 text-blue-700"
                    }`}>
                      {item.action_type === "UPDATE" ? "تعديل"
                        : item.action_type === "DELETE" ? "حذف"
                        : item.action_type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>

                {/* التغييرات */}
                {item.old_data && (
  <div className="space-y-1.5">
    <p className="text-xs text-slate-400 font-medium mb-1">التغييرات:</p>
    {Object.entries(
      typeof item.old_data === "string"
        ? JSON.parse(item.old_data)
        : item.old_data
    ).map(([key, val]: any) => (
      <div key={key}
        className="flex items-center gap-2 text-xs bg-white rounded-lg border border-slate-100 px-2.5 py-2">
        <span className="text-slate-400 shrink-0 min-w-fit">{key}:</span>
        <span className="text-red-400 line-through">{String(val.old ?? "—")}</span>
        <span className="text-slate-300">←</span>
        <span className="text-green-600 font-medium">{String(val.new ?? "—")}</span>
      </div>
    ))}
  </div>
)}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}