"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PlusCircle, ArrowRight, User, Network, Package, Tag,
  StickyNote, Loader2, Hash, Calendar, Plug, Briefcase,
  Building2, ListTree, Banknote, MapPin, IdCard, ScanLine,
  ImagePlus, X, CreditCard, AlertCircle, CheckCircle2,
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

interface FormState {
  number: string;
  customer_date_real: string;
  serial_number: string;
  note: string;
  report_note: string;
  has_sim: boolean;
  client_id: string;
  provider_id: string;
  account_id: string;
  almanafiz_id: string;
  department_id: string;
  group_id: string;
  agent_id: string;
  line_status_id: string;
  calls_package_id: string;
  internet_package_id: string;
  line_extension_id: string;
  _client_name: string;
  _department_name: string;
  _group_name: string;
  calls_package_price: string;
  internet_package_price: string;
  line_extension_price: string;
  total_price: string;
}

const EMPTY_FORM: FormState = {
  number: "",
  customer_date_real: "",
  serial_number: "",
  note: "",
  report_note: "",
  has_sim: false,
  client_id: "",
  provider_id: "",
  account_id: "",
  almanafiz_id: "",
  department_id: "",
  group_id: "",
  agent_id: "",
  line_status_id: "",
  calls_package_id: "",
  internet_package_id: "",
  line_extension_id: "",
  _client_name: "",
  _department_name: "",
  _group_name: "",
  calls_package_price: "",
  internet_package_price: "",
  line_extension_price: "",
  total_price: "",
};

// ─── Toast component ──────────────────────────────────────────
function Toast({ message, type, onClose }: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all ${
      type === "success"
        ? "bg-green-600 text-white"
        : "bg-red-600 text-white"
    }`}>
      {type === "success"
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onClose} className="opacity-70 hover:opacity-100 mr-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function NewLine() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [callsPackages, setCallsPackages] = useState<any[]>([]);
  const [internetPackages, setInternetPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [lineStatuses, setLineStatuses] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);

  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "", national_id: "", address: "", national_id_image: "",
  });
  const [savingClient, setSavingClient] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
  }

  function update(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node))
        setShowClientDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin" && role !== "super_admin") router.push("/lines");
  }, []);

  useEffect(() => {
    const total =
      Number(form.calls_package_price || 0) +
      Number(form.internet_package_price || 0) +
      Number(form.line_extension_price || 0);
    setForm((prev) => ({ ...prev, total_price: String(total) }));
  }, [form.calls_package_price, form.internet_package_price, form.line_extension_price]);

  async function handleProviderChange(providerId: string) {
    const [{ data: calls }, { data: internet }, { data: ext }, { data: statuses }, { data: acc }] =
      await Promise.all([
        supabase.from("calls_packages").select("*").eq("provider_id", Number(providerId)),
        supabase.from("internet_packages").select("*").eq("provider_id", Number(providerId)),
        supabase.from("line_extensions").select("*").eq("provider_id", Number(providerId)),
        supabase.from("line_statuses").select("*").eq("provider_id", Number(providerId)),
        supabase.from("accounts").select("id, account_no, account_name").eq("provider_id", Number(providerId)).order("account_no"),
      ]);
    setCallsPackages(calls || []);
    setInternetPackages(internet || []);
    setServices(ext || []);
    setLineStatuses(statuses || []);
    setAccountsList(acc || []);
    setForm((prev) => ({
      ...prev,
      provider_id: providerId,
      account_id: "",
      calls_package_id: "",
      calls_package_price: "",
      internet_package_id: "",
      internet_package_price: "",
      line_extension_id: "",
      line_extension_price: "",
      line_status_id: "",
    }));
  }

  function handleAlmanafizChange(almanafizId: string) {
    const selected = almanafizList.find((a) => a.id === Number(almanafizId));
    setForm((prev) => ({
      ...prev,
      almanafiz_id: almanafizId,
      group_id: String(selected?.groups?.id || ""),
      department_id: String(selected?.groups?.departments?.id || ""),
      _group_name: selected?.groups?.name || "",
      _department_name: selected?.groups?.departments?.name || "",
    }));
  }

  function selectClient(client: any) {
    setForm((prev) => ({ ...prev, client_id: String(client.id), _client_name: client.name }));
    setClientSearch("");
    setShowClientDropdown(false);
  }

  function clearClient() {
    setForm((prev) => ({ ...prev, client_id: "", _client_name: "" }));
    setClientSearch("");
  }

  // 1. أضيفي state جديد
const [filteredClients, setFilteredClients] = useState<any[]>([]);

// 2. أضيفي useEffect للبحث
useEffect(() => {
  if (!clientSearch.trim()) {
    setFilteredClients([]);
    return;
  }
  const timeout = setTimeout(async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, name, national_id")
      .or(`name.ilike.%${clientSearch}%,national_id.ilike.%${clientSearch}%`)
      .limit(10);
    setFilteredClients(data || []);
  }, 300);
  return () => clearTimeout(timeout);
}, [clientSearch]);

  async function saveNewClient() {
    if (!clientForm.name.trim()) { showToast("اسم العميل مطلوب", "error"); return; }
    setSavingClient(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: clientForm.name.trim(),
        national_id: clientForm.national_id.trim() || null,
        address: clientForm.address.trim() || null,
        national_id_image: clientForm.national_id_image.trim() || null,
      })
      .select().single();
    setSavingClient(false);
    if (error) { showToast(error.message, "error"); return; }
    setClientsList((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({ ...prev, client_id: String(data.id), _client_name: data.name }));
    setClientForm({ name: "", national_id: "", address: "", national_id_image: "" });
    setClientModalOpen(false);
    showToast("تم إضافة العميل بنجاح", "success");
  }

  // ─── Validation ───────────────────────────────────────────
  function validate(): string | null {
    if (!form.number)
      return "رقم الخط مطلوب";
    if (!/^\d{11}$/.test(form.number))
      return "رقم الخط لازم يكون 11 رقم بالظبط";
    if (!form.client_id)
      return "اختاري العميل";
    if (!form.provider_id)
      return "اختاري الشبكة";
    if (!form.account_id)
      return "اختاري الأكونت";
    if (!form.almanafiz_id)
      return "اختاري المنفذ";
    if (!form.agent_id)
      return "اختاري المندوب";
    if (!form.line_status_id)
      return "اختاري حالة الخط";
    if (!form.calls_package_id)
      return "اختاري باقة المكالمات";
    
    if (form.serial_number && !/^\d{18}$/.test(form.serial_number))
      return "السيريال نمبر لازم يكون 18 رقم بالظبط";
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("lines").insert({
      number: form.number,
      customer_date_real: form.customer_date_real || null,
      serial_number: form.serial_number || null,
      note: form.note || null,
      report_note: form.report_note || null,
      has_sim: form.has_sim,
      client_id:           form.client_id          ? Number(form.client_id)          : null,
      provider_id:         form.provider_id         ? Number(form.provider_id)        : null,
      account_id:          form.account_id          ? Number(form.account_id)         : null,
      almanafiz_id:        form.almanafiz_id        ? Number(form.almanafiz_id)       : null,
      department_id:       form.department_id       ? Number(form.department_id)      : null,
      group_id:            form.group_id            ? Number(form.group_id)           : null,
      agent_id:            form.agent_id            ? Number(form.agent_id)           : null,
      line_status_id:      form.line_status_id      ? Number(form.line_status_id)     : null,
      calls_package_id:    form.calls_package_id    ? Number(form.calls_package_id)   : null,
      internet_package_id: form.internet_package_id ? Number(form.internet_package_id): null,
      line_extension_id:   form.line_extension_id   ? Number(form.line_extension_id)  : null,
      calls_package_price:    Number(form.calls_package_price || 0),
      internet_package_price: Number(form.internet_package_price || 0),
      line_extension_price:   Number(form.line_extension_price || 0),
      total_price:            Number(form.total_price || 0),
    });

    setLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    // history
    await supabase.from("history").insert({
      number: form.number,
      customer_name: clientsList.find((c) => c.id === Number(form.client_id))?.name || null,
      action_type: "created",
      action_date: new Date().toISOString(),
      changed_by: localStorage.getItem("full_name") || "Unknown",
      provider_name: providers.find((p) => p.id === Number(form.provider_id))?.name || null,
      almanafiz_name: almanafizList.find((a) => a.id === Number(form.almanafiz_id))?.name || null,
      agent_name: agentsList.find((a) => a.id === Number(form.agent_id))?.name || null,
      account_no: accountsList.find((a) => a.id === Number(form.account_id))?.account_no || null,
      line_status_name: lineStatuses.find((s) => s.id === Number(form.line_status_id))?.name || null,
      calls_package_name: callsPackages.find((p) => p.id === Number(form.calls_package_id))?.package_name || null,
      internet_package_name: internetPackages.find((p) => p.id === Number(form.internet_package_id))?.package_name || null,
      line_extension_name: services.find((s) => s.id === Number(form.line_extension_id))?.extension_name || null,
      total_price: Number(form.total_price || 0),
      has_sim: form.has_sim,
      serial_number: form.serial_number || null,
    });

    showToast("تم إضافة الخط بنجاح ✅", "success");

    setForm(EMPTY_FORM);
    setImageFile(null);
    setCallsPackages([]);
    setInternetPackages([]);
    setServices([]);
    setLineStatuses([]);
    setAccountsList([]);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <PlusCircle className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">إضافة خط جديد</h1>
              <p className="text-sm text-blue-100 mt-0.5">املأ البيانات التالية لإضافة خط جديد للنظام</p>
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
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                رقم الخط <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={form.number}
                  onChange={(e) => update("number", e.target.value)}
                  placeholder="11 رقم"
                  maxLength={11}
                  className={`w-full border bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 text-sm ${
                    form.number && form.number.length !== 11
                      ? "border-red-300 focus:ring-red-200"
                      : "border-slate-200 focus:ring-blue-200"
                  }`}
                />
              </div>
              {form.number && form.number.length !== 11 && (
                <p className="text-xs text-red-500 mt-1">{form.number.length}/11 رقم</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Plug className="w-3.5 h-3.5" /> المنفذ <span className="text-red-500">*</span>
              </label>
              <select value={form.almanafiz_id} onChange={(e) => handleAlmanafizChange(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">اختر المنفذ</option>
                {almanafizList.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                سيريال نمبر <span className="text-slate-400 text-xs">(اختياري — 18 رقم)</span>
              </label>
              <div className="relative">
                <ScanLine className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={form.serial_number}
                  onChange={(e) => update("serial_number", e.target.value)}
                  placeholder="18 رقم"
                  maxLength={18}
                  className={`w-full border bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 text-sm ${
                    form.serial_number && form.serial_number.length !== 18
                      ? "border-red-300 focus:ring-red-200"
                      : "border-slate-200 focus:ring-blue-200"
                  }`}
                />
              </div>
              {form.serial_number && form.serial_number.length !== 18 && (
                <p className="text-xs text-red-500 mt-1">{form.serial_number.length}/18 رقم</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">تاريخ العميل</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="date" value={form.customer_date_real}
                  onChange={(e) => update("customer_date_real", e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* العميل */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="العميل" icon={User} />
          <div ref={clientRef} className="relative">
            <label className="block text-xs text-slate-500 mb-1.5">
              اسم العميل <span className="text-red-500">*</span>
            </label>
            {form.client_id ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-800">{form._client_name}</span>
                </div>
                <button onClick={clearClient} className="text-blue-400 hover:text-blue-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="ابحث بالاسم أو الرقم القومي..."
                    className="w-full border border-slate-200 bg-slate-50 text-slate-900 pr-10 pl-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {filteredClients.map((c) => (
                        <button key={c.id} type="button" onClick={() => selectClient(c)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-right transition">
                          <span className="text-sm font-medium text-slate-800">{c.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{c.national_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showClientDropdown && clientSearch.trim() && filteredClients.length === 0 && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 px-4 py-3 text-sm text-slate-400">
                      مش لاقي عميل
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setClientModalOpen(true)}
                  className="w-11 h-11 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition shrink-0" title="إضافة عميل جديد">
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* بيانات الشبكة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Network className="w-3.5 h-3.5" /> الشبكة <span className="text-red-500">*</span>
              </label>
              <select value={form.provider_id} onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">اختر الشبكة</option>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <CreditCard className="w-3.5 h-3.5" /> الأكونت <span className="text-red-500">*</span>
              </label>
              <select value={form.account_id} onChange={(e) => update("account_id", e.target.value)}
                disabled={!form.provider_id}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{form.provider_id ? "اختر الأكونت" : "اختر الشبكة أولاً"}</option>
                {accountsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_no}{a.account_name ? ` — ${a.account_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* الباقات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والإضافات" icon={Package} />
          {!form.provider_id && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
              اختاري الشبكة الأول عشان الباقات المتاحة تظهر هنا
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" /> باقة المكالمات <span className="text-red-500">*</span>
              </label>
              <select value={form.calls_package_id}
                onChange={(e) => {
                  const selected = callsPackages.find((x) => x.id === Number(e.target.value));
                  setForm((prev) => ({ ...prev, calls_package_id: e.target.value, calls_package_price: String(selected?.price || "") }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">باقة المكالمات</option>
                {callsPackages.map((item) => (
                  <option key={item.id} value={item.id}>{item.package_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" /> سعر باقة المكالمات
              </label>
              <input value={form.calls_package_price}
                onChange={(e) => update("calls_package_price", e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" /> باقة الإنترنت <span className="text-red-500">*</span>
              </label>
              <select value={form.internet_package_id}
                onChange={(e) => {
                  const selected = internetPackages.find((x) => x.id === Number(e.target.value));
                  setForm((prev) => ({ ...prev, internet_package_id: e.target.value, internet_package_price: String(selected?.price || "") }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">باقة الإنترنت</option>
                {internetPackages.map((item) => (
                  <option key={item.id} value={item.id}>{item.package_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" /> سعر باقة الإنترنت
              </label>
              <input value={form.internet_package_price}
                onChange={(e) => update("internet_package_price", e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Package className="w-3.5 h-3.5" /> الإضافة
              </label>
              <select value={form.line_extension_id}
                onChange={(e) => {
                  const selected = services.find((x) => x.id === Number(e.target.value));
                  setForm((prev) => ({ ...prev, line_extension_id: e.target.value, line_extension_price: String(selected?.price || "") }));
                }}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">الإضافة</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>{item.extension_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" /> سعر الإضافة
              </label>
              <input value={form.line_extension_price}
                onChange={(e) => update("line_extension_price", e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium" />
            </div>
          </div>
        </div>

        {/* التصنيف */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="التصنيف والسعر الإجمالي" icon={Tag} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">القسم</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input readOnly value={form._department_name} placeholder="يتعبأ أوتوماتيك من المنفذ"
                  className="w-full border border-slate-200 bg-slate-100 text-slate-600 pr-10 pl-3 py-3 rounded-xl text-sm cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">الجروب</label>
              <div className="relative">
                <ListTree className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input readOnly value={form._group_name} placeholder="يتعبأ أوتوماتيك من المنفذ"
                  className="w-full border border-slate-200 bg-slate-100 text-slate-600 pr-10 pl-3 py-3 rounded-xl text-sm cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Briefcase className="w-3.5 h-3.5" /> المندوب <span className="text-red-500">*</span>
              </label>
              <select value={form.agent_id} onChange={(e) => update("agent_id", e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm">
                <option value="">اختر المندوب</option>
                {agentsList.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Tag className="w-3.5 h-3.5" /> حالة الخط <span className="text-red-500">*</span>
              </label>
              <select value={form.line_status_id} onChange={(e) => update("line_status_id", e.target.value)}
                disabled={!form.provider_id}
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">{form.provider_id ? "اختر حالة الخط" : "اختر الشبكة أولاً"}</option>
                {lineStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                <Banknote className="w-3.5 h-3.5" /> إجمالي السعر
              </label>
              <input disabled value={form.total_price}
                className="w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" />
            </div>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 self-end">
              <input type="checkbox" id="has_sim"
                checked={form.has_sim}
                onChange={(e) => update("has_sim", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
              <label htmlFor="has_sim" className="text-sm text-slate-700 cursor-pointer select-none">
                الرقم على شريحة
              </label>
            </div>
          </div>
        </div>

        {/* ملاحظات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="ملاحظات" icon={StickyNote} />
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ملاحظات</label>
              <textarea value={form.note} onChange={(e) => update("note", e.target.value)}
                placeholder="ملاحظات (اختياري)"
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" rows={4} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ملاحظات التقرير</label>
              <textarea value={form.report_note} onChange={(e) => update("report_note", e.target.value)}
                placeholder="ملاحظات التقرير (اختياري)"
                className="w-full border border-slate-200 bg-slate-50 text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" rows={4} />
            </div>
          </div>
        </div>

        {/* Save */}
        <button onClick={save} disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-medium shadow-sm transition">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</>
            : <><PlusCircle className="w-4 h-4" />حفظ الخط</>}
        </button>

      </div>

      {/* Modal إضافة عميل */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">إضافة عميل جديد</h2>
              <button onClick={() => setClientModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: "اسم العميل *", field: "name", icon: User, placeholder: "اسم العميل" },
                { label: "الرقم القومي", field: "national_id", icon: IdCard, placeholder: "الرقم القومي" },
                { label: "العنوان", field: "address", icon: MapPin, placeholder: "العنوان" },
                { label: "رابط صورة البطاقة", field: "national_id_image", icon: ImagePlus, placeholder: "رابط الصورة" },
              ].map(({ label, field, icon: Icon, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
                  <div className="relative">
                    <Icon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={clientForm[field as keyof typeof clientForm]}
                      onChange={(e) => setClientForm((p) => ({ ...p, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveNewClient} disabled={savingClient}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {savingClient ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</> : <><PlusCircle className="w-4 h-4" />إضافة العميل</>}
              </button>
              <button onClick={() => setClientModalOpen(false)}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}