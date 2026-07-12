"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import {
  Pencil, ArrowRight, User, Network, Package, Tag,
  StickyNote, Loader2, Hash, Calendar, Plug, Briefcase,
  Building2, ListTree, Banknote, History, Save,
  ScanLine, ImagePlus, Upload, CreditCard, IdCard, MapPin, X,
  CheckCircle2, AlertCircle, Search, ChevronDown,
  PlusCircle,
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

// ─── Searchable Select (لقوائم محدودة زي المنفذ/الشبكة) ───────
function SearchableSelect({
  value, onChange, options, placeholder, disabled = false,
  getLabel, getValue,
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: any[];
  placeholder: string;
  disabled?: boolean;
  getLabel: (item: any) => string;
  getValue: (item: any) => string | number;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedItem = options.find((o) => String(getValue(o)) === String(value));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.trim()
    ? options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center justify-between border rounded-xl px-3 py-3 text-sm transition ${
          disabled
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-white border-slate-200 text-slate-900 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
        }`}
      >
        <span className={selectedItem ? "text-slate-900" : "text-slate-400"}>
          {selectedItem ? getLabel(selectedItem) : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <span onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
              className="text-slate-400 hover:text-slate-600 p-0.5">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <button key={getValue(item)} type="button"
                  onClick={() => { onChange(String(getValue(item))); setSearch(""); setOpen(false); }}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-slate-50 transition ${
                    String(getValue(item)) === String(value) ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                  }`}>
                  {getLabel(item)}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">مش لاقي نتايج</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── بحث حي للعميل مباشرة من الداتابيز (يحل مشكلة حد الـ 1000 صف) ───
function ClientLiveSearch({ value, currentClient, onChange }: {
  value: string | number; currentClient?: any;
  onChange: (val: string, client?: any) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, national_id")
        .or(`name.ilike.%${search}%,national_id.ilike.%${search}%`)
        .limit(30);
      setResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border rounded-xl px-3 py-3 text-sm bg-white border-slate-200 hover:border-blue-300 focus:outline-none">
        <span className={currentClient ? "text-slate-900" : "text-slate-400"}>
          {currentClient ? currentClient.name : "ابحث باسم العميل أو الرقم القومي..."}
        </span>
        {value && (
          <span onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
            className="text-slate-400 hover:text-slate-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="اكتبي اسم العميل أو الرقم القومي..."
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
          </div>
          <div className="overflow-y-auto flex-1">
            {searching && <p className="px-3 py-3 text-xs text-slate-400 text-center">جارٍ البحث...</p>}
            {!searching && results.map((item) => (
              <button key={item.id} type="button"
                onClick={() => { onChange(String(item.id), item); setSearch(""); setOpen(false); }}
                className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 transition text-slate-700">
                {item.name} {item.national_id && <span className="text-xs text-slate-400">— {item.national_id}</span>}
              </button>
            ))}
            {!searching && search.trim() && results.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">مش لاقي نتايج</p>
            )}
            {!search.trim() && (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">اكتبي حرفين على الأقل للبحث</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass = "w-full border border-slate-200 bg-white text-slate-900 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm";
const readonlyClass = "w-full border border-slate-200 p-3 rounded-xl bg-slate-100 text-slate-500 text-sm cursor-not-allowed";

// ─── Confirm Modal (بديل الـ confirm() الافتراضي) ─────────────
function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Ban className="w-5 h-5 text-red-600" />
          </span>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-medium text-sm transition">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            {confirmLabel}
          </button>
          <button onClick={onCancel} disabled={loading}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditLine({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [line, setLine] = useState<any>(null);
  const [id, setId] = useState("");
  const [originalLine, setOriginalLine] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [almanafizList, setAlmanafizList] = useState<any[]>([]);
  const [heiaatList, setHeiaatList] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [lineStatuses, setLineStatuses] = useState<any[]>([]);
  const [callsPackages, setCallsPackages] = useState<any[]>([]);
  const [internetPackages, setInternetPackages] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", national_id: "", address: "", national_id_image: "" });
  const [savingClient, setSavingClient] = useState(false);

  // Deactivate confirm modal state
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Init ─────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const p = await params;
      setId(p.id);

      const { data } = await supabase
        .from("lines")
        .select("*, clients(id, name, national_id)")
        .eq("id", p.id)
        .single();

      if (data) {
        setLine(data);
        setOriginalLine(data);
        await loadHistory(p.id);
        if (data.provider_id) await loadPackagesStatusesAccounts(data.provider_id);
        if (data.almanafiz_id) await loadPortDetails("almanafiz", data.almanafiz_id);
        if (data.heiaat_id) await loadPortDetails("heiaat", data.heiaat_id);
        // أضيفي العميل الحالي في القائمة (لعرض اسمه فوراً)
        if (data.clients) {
          setClientsList((prev) => {
            if (prev.some((c) => c.id === data.clients.id)) return prev;
            return [...prev, data.clients];
          });
        }
      }
    }
    init();
  }, [params]);

  // ─── Load lookups (بدون العملاء — بقى بحث حي منفصل) ────────
  useEffect(() => {
    async function loadLookups() {
      const [{ data: p }, { data: a }, { data: h }, { data: ag }] = await Promise.all([
        supabase.from("providers").select("*"),
        supabase.from("almanafiz").select("*, groups(id, name, departments(id, name))"),
        supabase.from("heiaat").select("*, groups(id, name, departments(id, name))"),
        supabase.from("agents").select("*").eq("is_active", true),
      ]);
      setProviders(p || []);
      setAlmanafizList(a || []);
      setHeiaatList(h || []);
      setAgentsList(ag || []);
    }
    loadLookups();
  }, []);

  // ─── Deactivate ───────────────────────────────────────────
  function openDeactivateModal() {
    setDeactivateModalOpen(true);
  }

  async function confirmDeactivate() {
    setDeactivating(true);

    const deactiveDate = new Date();
    let durationDays: number | null = null;
    if (line.customer_date_real) {
      const customerDate = new Date(line.customer_date_real);
      const diffMs = deactiveDate.getTime() - customerDate.getTime();
      durationDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const { data: currentLineData } = await supabase
      .from("lines")
      .select("client_id, almanafiz_id, heiaat_id, customer_date_real, clients(name, national_id, address), almanafiz(name), heiaat(name)")
      .eq("id", id)
      .single();

    const clientName = (currentLineData?.clients as any)?.name || null;
    const clientNationalId = (currentLineData?.clients as any)?.national_id || null;
    const clientAddress = (currentLineData?.clients as any)?.address || null;
    const almanafizName = (currentLineData?.almanafiz as any)?.name || (currentLineData?.heiaat as any)?.name || null;

    await supabase.from("history").insert({
      number: line.number,
      customer_name: clientName,
      national_id: clientNationalId,
      address: clientAddress,
      almanafiz: almanafizName,
      action_type: "deactivated",
      action_date: deactiveDate.toISOString(),
    });

    await supabase.from("audit_logs").insert({
      user_name: localStorage.getItem("full_name") || "Unknown",
      action_type: "DEACTIVATE",
      table_name: "lines",
      record_id: String(id),
      old_data: {
        client: { old: clientName || "—", new: "—" },
        almanafiz: { old: almanafizName || "—", new: "—" },
        customer_date: { old: currentLineData?.customer_date_real || "—", new: "—" },
      },
    });

    const { error } = await supabase.from("lines").update({
      client_id: null,
      almanafiz_id: null,
      heiaat_id: null,
      customer_date_real: null,
      is_deactive: true,
      deactive_date: deactiveDate.toISOString(),
      active_duration_days: durationDays,
    }).eq("id", id);

    setDeactivating(false);
    setDeactivateModalOpen(false);

    if (error) { showToast(error.message, "error"); return; }

    showToast("تم إلغاء تفعيل الخط بنجاح", "success");

    setLine((prev: any) => ({
      ...prev,
      client_id: null,
      almanafiz_id: null,
      heiaat_id: null,
      customer_date_real: null,
      is_deactive: true,
      clients: null,
    }));
    setOriginalLine((prev: any) => ({ ...prev, is_deactive: true, client_id: null, almanafiz_id: null, heiaat_id: null, customer_date_real: null }));
    setGroupName("");
    setDepartmentName("");
    await loadHistory(id);
  }

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

  async function loadPortDetails(portType: "almanafiz" | "heiaat", portId: number) {
    if (portType === "almanafiz") {
      const found = almanafizList.find((a) => a.id === portId);
      if (found) {
        setGroupName(found.groups?.name || "");
        setDepartmentName(found.groups?.departments?.name || "");
        return;
      }
      const { data } = await supabase
        .from("almanafiz").select("*, groups(id, name, departments(id, name))")
        .eq("id", portId).single();
      if (data) {
        setGroupName(data.groups?.name || "");
        setDepartmentName(data.groups?.departments?.name || "");
      }
      return;
    }

    const found = heiaatList.find((h) => h.id === portId);
    if (found) {
      setGroupName(found.groups?.name || "");
      setDepartmentName(found.groups?.departments?.name || "");
      return;
    }
    const { data } = await supabase
      .from("heiaat").select("*, groups(id, name, departments(id, name))")
      .eq("id", portId).single();
    if (data) {
      setGroupName(data.groups?.name || "");
      setDepartmentName(data.groups?.departments?.name || "");
    }
  }

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
    setClientsList((prev) => [...prev, data]);
    setLine((prev: any) => ({ ...prev, client_id: data.id, clients: data }));
    setClientForm({ name: "", national_id: "", address: "", national_id_image: "" });
    setClientModalOpen(false);
    showToast("تم إضافة العميل بنجاح", "success");
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

  async function handlePortChange(selection: string) {
    const [type, id] = selection.split(":");
    const portId = Number(id);
    const isAlmanafiz = type === "almanafiz";
    const isHeiaat = type === "heiaat";
    const selected = isAlmanafiz
      ? almanafizList.find((a) => a.id === portId)
      : isHeiaat
      ? heiaatList.find((h) => h.id === portId)
      : null;

    setGroupName(selected?.groups?.name || "");
    setDepartmentName(selected?.groups?.departments?.name || "");
    setLine((prev: any) => ({
      ...prev,
      almanafiz_id: isAlmanafiz ? portId : null,
      heiaat_id: isHeiaat ? portId : null,
      group_id: selected?.groups?.id || null,
      department_id: selected?.groups?.departments?.id || null,
    }));
  }

  // ─── Load history ─────────────────────────────────────────
  async function loadHistory(lineId: string) {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("table_name", "lines")
      .eq("record_id", String(lineId))
      .order("created_at", { ascending: false });

    const filtered = (data || []).filter(
      (item) => String(item.record_id) === String(lineId)
    );
    setHistoryList(filtered);
  }

  // ─── Save ─────────────────────────────────────────────────
  async function save() {
    const changes: any = {};

    const oldClientName = originalLine.clients?.name || "—";
    const newClientName = clientsList.find((c) => c.id === Number(line.client_id))?.name
      || line.clients?.name || (line.client_id ? "—" : "—");
    if (Number(originalLine.client_id) !== Number(line.client_id))
      changes.client = { old: oldClientName, new: newClientName };

    if (Number(originalLine.provider_id) !== Number(line.provider_id))
      changes.provider = {
        old: providers.find((p) => p.id === Number(originalLine.provider_id))?.name || "—",
        new: providers.find((p) => p.id === Number(line.provider_id))?.name || "—",
      };
    const oldPort = originalLine.almanafiz_id
      ? almanafizList.find((a) => a.id === Number(originalLine.almanafiz_id))
      : heiaatList.find((h) => h.id === Number(originalLine.heiaat_id));
    const newPort = line.almanafiz_id
      ? almanafizList.find((a) => a.id === Number(line.almanafiz_id))
      : heiaatList.find((h) => h.id === Number(line.heiaat_id));
    if ((oldPort?.name || "") !== (newPort?.name || ""))
      changes.port = {
        old: oldPort?.name || "—",
        new: newPort?.name || "—",
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

    const shouldReactivate = Boolean(originalLine.is_deactive) && Boolean(line.client_id || line.almanafiz_id || line.heiaat_id);
    if (shouldReactivate) {
      changes.status = { old: "ملغى (Deactive)", new: "مفعّل" };
    }

    if (Object.keys(changes).length > 0) {
      await supabase.from("audit_logs").insert({
        user_name: localStorage.getItem("full_name") || "Unknown",
        action_type: shouldReactivate ? "REACTIVATE" : "UPDATE",
        table_name: "lines",
        record_id: String(id),
        old_data: changes,
      });
    }

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
      heiaat_id:           line.heiaat_id           ? Number(line.heiaat_id)           : null,
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
      total_price:             Number(line.total_price || 0),
      is_deactive: shouldReactivate ? false : Boolean(line.is_deactive),
    }).eq("id", id);

    if (error) { showToast(error.message, "error"); return; }

    showToast(shouldReactivate ? "تم حفظ التعديلات وإعادة تفعيل الخط ✅" : "تم حفظ التعديلات ✅", "success");
    await loadHistory(id);
    const updatedLine = { ...line, is_deactive: shouldReactivate ? false : line.is_deactive };
    setLine(updatedLine);
    setOriginalLine(updatedLine);
  }

  if (!line) return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin ml-2" /> جاري التحميل...
    </div>
  );

  const currentClient = clientsList.find((c) => c.id === Number(line.client_id)) || line.clients;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Deactivate confirm modal */}
      <ConfirmModal
        open={deactivateModalOpen}
        title="إلغاء تفعيل الخط"
        message="هل أنتِ متأكدة من إلغاء تفعيل الخط؟ هيتم مسح بيانات العميل والمنفذ وحفظهم في السجل، ويظل الخط قابل لإعادة التفعيل لاحقاً."
        confirmLabel="تأكيد الإلغاء"
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateModalOpen(false)}
        loading={deactivating}
      />

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Pencil className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">تعديل بيانات الخط</h1>
              <p className="text-sm text-blue-100 mt-0.5">
                رقم الخط: {line.number}
                {line.is_deactive && (
                  <span className="mr-2 inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    <Ban className="w-3 h-3" /> ملغى (Deactive)
                  </span>
                )}
              </p>
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
              <SearchableSelect
                value={line.almanafiz_id ? `almanafiz:${line.almanafiz_id}` : line.heiaat_id ? `heiaat:${line.heiaat_id}` : ""}
                onChange={(val) => handlePortChange(val)}
                options={[
                  ...almanafizList.map((item) => ({ ...item, portType: "almanafiz" })),
                  ...heiaatList.map((item) => ({ ...item, portType: "heiaat" })),
                ]}
                placeholder="اختر المنفذ أو الهيئة"
                getLabel={(item) => `${item.name} ${item.portType === "heiaat" ? "(هيئة)" : "(منفذ)"}`}
                getValue={(item) => `${item.portType}:${item.id}`}
              />
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

        {/* العميل — بحث حي مباشر من الداتابيز */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="العميل" icon={User} />
          <FieldWrap label="اسم العميل" icon={User}>
            <div className="flex gap-3">
              <div className="flex-1">
                <ClientLiveSearch
                  value={line.client_id || ""}
                  currentClient={currentClient}
                  onChange={(val, client) => {
                    setLine({ ...line, client_id: val, clients: client || null });
                    if (client) setClientsList((prev) => prev.some((c) => c.id === client.id) ? prev : [...prev, client]);
                  }}
                />
              </div>
              <button type="button" onClick={() => setClientModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition shrink-0">
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          </FieldWrap>
        </div>

        {/* بيانات الشبكة */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="بيانات الشبكة" icon={Network} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="الشبكة" icon={Network}>
              <SearchableSelect
                value={line.provider_id || ""}
                onChange={(val) => handleProviderChange(val)}
                options={providers}
                placeholder="اختر الشبكة"
                getLabel={(item) => item.name}
                getValue={(item) => item.id}
              />
            </FieldWrap>
            <FieldWrap label="الأكونت" icon={CreditCard}>
              <SearchableSelect
                value={line.account_id || ""}
                onChange={(val) => setLine({ ...line, account_id: val })}
                options={accountsList}
                placeholder={line.provider_id ? "اختر الأكونت" : "اختر الشبكة أولاً"}
                disabled={!line.provider_id}
                getLabel={(item) => `${item.account_no}${item.account_name ? ` — ${item.account_name}` : ""}`}
                getValue={(item) => item.id}
              />
            </FieldWrap>
            <FieldWrap label="القسم" icon={Building2}>
              <input readOnly className={readonlyClass} value={departmentName} placeholder="يتعبأ أوتوماتيك" />
            </FieldWrap>
            <FieldWrap label="الجروب" icon={ListTree}>
              <input readOnly className={readonlyClass} value={groupName} placeholder="يتعبأ أوتوماتيك" />
            </FieldWrap>
            <FieldWrap label="المندوب" icon={Briefcase}>
              <SearchableSelect
                value={line.agent_id || ""}
                onChange={(val) => setLine({ ...line, agent_id: val })}
                options={agentsList}
                placeholder="اختر المندوب"
                getLabel={(item) => item.name}
                getValue={(item) => item.id}
              />
            </FieldWrap>
            <FieldWrap label="حالة الخط" icon={Tag}>
              <SearchableSelect
                value={line.line_status_id || ""}
                onChange={(val) => setLine({ ...line, line_status_id: val })}
                options={lineStatuses}
                placeholder={line.provider_id ? "اختر حالة الخط" : "اختر الشبكة أولاً"}
                disabled={!line.provider_id}
                getLabel={(item) => item.name}
                getValue={(item) => item.id}
              />
            </FieldWrap>
          </div>
        </div>

        {/* الباقات */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <SectionTitle title="الباقات والخدمات" icon={Package} />
          <div className="grid md:grid-cols-2 gap-4">
            <FieldWrap label="باقة المكالمات" icon={Package}>
              <SearchableSelect
                value={line.calls_package_id || ""}
                onChange={(val) => {
                  const selected = callsPackages.find((x) => x.id === Number(val));
                  setLine({ ...line, calls_package_id: Number(val), calls_package_price: selected?.price || 0 });
                }}
                options={callsPackages}
                placeholder="باقة المكالمات"
                getLabel={(item) => item.package_name}
                getValue={(item) => item.id}
              />
            </FieldWrap>
            <FieldWrap label="سعر باقة المكالمات" icon={Banknote}>
              <input className={inputClass} value={line.calls_package_price || ""}
                onChange={(e) => setLine({ ...line, calls_package_price: e.target.value })} />
            </FieldWrap>
            <FieldWrap label="باقة الإنترنت" icon={Package}>
              <SearchableSelect
                value={line.internet_package_id || ""}
                onChange={(val) => {
                  const selected = internetPackages.find((x) => x.id === Number(val));
                  setLine({ ...line, internet_package_id: Number(val), internet_package_price: selected?.price || 0 });
                }}
                options={internetPackages}
                placeholder="باقة الإنترنت"
                getLabel={(item) => item.package_name}
                getValue={(item) => item.id}
              />
            </FieldWrap>
            <FieldWrap label="سعر باقة الإنترنت" icon={Banknote}>
              <input className={inputClass} value={line.internet_package_price || ""}
                onChange={(e) => setLine({ ...line, internet_package_price: e.target.value })} />
            </FieldWrap>
            <FieldWrap label="الإضافة" icon={Package}>
              <SearchableSelect
                value={line.line_extension_id || ""}
                onChange={(val) => {
                  const selected = services.find((x) => x.id === Number(val));
                  setLine({ ...line, line_extension_id: Number(val), line_extension_price: selected?.price || 0 });
                }}
                options={services}
                placeholder="الإضافة"
                getLabel={(item) => item.extension_name}
                getValue={(item) => item.id}
              />
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
        <div className="flex justify-between mb-6">
          <button onClick={openDeactivateModal}
            disabled={line.is_deactive}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 px-6 py-3 rounded-xl font-medium transition border border-red-200">
            <Ban className="w-4 h-4" /> {line.is_deactive ? "الخط ملغى بالفعل" : "Deactive"}
          </button>

          <button onClick={save}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition text-white px-8 py-3 rounded-xl shadow-sm font-medium">
            <Save className="w-4 h-4" /> حفظ التعديلات
          </button>
        </div>

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
                        value={(clientForm as any)[field]}
                        onChange={(e) => setClientForm((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-slate-200 bg-slate-50 pr-10 pl-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={saveNewClient}
                  disabled={savingClient}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                  {savingClient ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</> : <><PlusCircle className="w-4 h-4" /> إضافة العميل</>}
                </button>
                <button type="button" onClick={() => setClientModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

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
            {historyList.map((item) => {
              const actionLabel =
                item.action_type === "DELETE" ? "حذف" :
                item.action_type === "DEACTIVATE" ? "إلغاء تفعيل" :
                item.action_type === "REACTIVATE" ? "إعادة تفعيل" :
                item.action_type === "UPDATE" ? "تعديل" : item.action_type;

              const actionColor =
                item.action_type === "DELETE" ? "bg-red-50 text-red-700" :
                item.action_type === "DEACTIVATE" ? "bg-orange-50 text-orange-700" :
                item.action_type === "REACTIVATE" ? "bg-green-50 text-green-700" :
                "bg-blue-50 text-blue-700";

              return (
                <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                        {item.user_name?.charAt(0) || "?"}
                      </span>
                      <span className="text-sm font-bold text-slate-700">{item.user_name || "—"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor}`}>
                        {actionLabel}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString("ar-EG")}
                    </span>
                  </div>

                  {item.old_data && Object.keys(item.old_data).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400 font-medium mb-1">التغييرات:</p>
                      {Object.entries(
                        typeof item.old_data === "string" ? JSON.parse(item.old_data) : item.old_data
                      ).map(([key, val]: any) => (
                        <div key={key} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-slate-100 px-2.5 py-2">
                          <span className="text-slate-400 shrink-0 min-w-fit">{key}:</span>
                          <span className="text-red-400 line-through">{String(val.old ?? "—")}</span>
                          <span className="text-slate-300">←</span>
                          <span className="text-green-600 font-medium">{String(val.new ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}