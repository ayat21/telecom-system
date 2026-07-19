"use client";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download, FileSpreadsheet, Trash2, RefreshCw, PlusCircle,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Database, ChevronDown, User, Ban,
} from "lucide-react";

type ImportType = "full" | "bulk_update" | "bulk_delete" | "add_column" | "update_clients" | "bulk_deactivate";

interface ImportResult {
  status: "success" | "error";
  message: string;
  details?: string;
  debugColumns?: string[];
  debugRows?: any[];
}

interface RowError {
  row: number;
  number: string;
  errors: string[];
}

const UPDATABLE_COLUMNS: { key: string; label: string }[] = [
  { key: "client_name", label: "اسم العميل" },
  { key: "national_id", label: "الرقم القومي" },
  { key: "address", label: "العنوان" },
  { key: "account_no", label: "رقم الأكونت (اسم)" },
  { key: "customer_date_real", label: "تاريخ العميل" },
  { key: "serial_number", label: "الرقم التسلسلي" },
  { key: "note", label: "ملاحظة" },
  { key: "report_note", label: "ملاحظة التقرير" },
  { key: "provider_name", label: "الشبكة (اسم)" },
  { key: "almanafiz_name", label: "المنفذ / الهيئة (اسم)" },
  { key: "agent_name", label: "المندوب (اسم)" },
  { key: "line_status_name", label: "حالة الخط (اسم)" },
  { key: "calls_package_name", label: "باقة المكالمات (اسم)" },
  { key: "internet_package_name", label: "باقة الإنترنت (اسم)" },
  { key: "line_extension_name", label: "الإضافة (اسم)" },
  { key: "calls_package_price", label: "سعر باقة المكالمات" },
  { key: "internet_package_price", label: "سعر باقة الإنترنت" },
  { key: "line_extension_price", label: "سعر الإضافة" },
  { key: "has_sim", label: "على شريحة (true/false)" },
];

// ─── تطبيع رقم الخط من الشيت ─────────────────────────────────
// بتعالج مشاكل شائعة في إكسبورت الأرقام: خانة رقمية بتاكل الصفر الأول
// (01xxxxxxxxx بيبقى 10 خانات بس)، أرقام عربي (٠-٩)، أو رموز/مسافات جوه الرقم
function normalizeLineNumber(raw: any): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  s = s.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  s = s.replace(/\D/g, "");
  if (s.length === 10 && !s.startsWith("0")) s = "0" + s;
  return s;
}

// مطابقة اسم عمود من الشيت من غير حساسية لحالة الحروف أو المسافات الزيادة
// (عشان "Client_Name"، "client_name "، "اسم العميل" كلهم يتقابلوا مع بعض)
function getRowField(row: any, ...candidates: string[]): string {
  const normalized: Record<string, any> = {};
  for (const k of Object.keys(row)) normalized[k.trim().toLowerCase()] = row[k];
  for (const c of candidates) {
    const v = normalized[c.trim().toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function lookupId(cache: Map<string, number>, table: string, name: string): number | null {
  if (!name?.trim()) return null;
  return cache.get(`${table}:${name.trim().toLowerCase()}`) ?? null;
}

// إكسيل بيخزّن قيمة واحدة بس في أول خلية من أي "خلايا مدموجة" (merged cells)،
// وباقي الخلايا في نفس المدى فاضية فعلياً — حتى لو شكلها في الملف إنها متملية بنفس القيمة.
// من غير الدالة دي، sheet_to_json هيرجّع فاضي لكل الصفوف ما عدا أول صف في كل مجموعة مدموجة.
function fillMergedCells(sheet: XLSX.WorkSheet): number {
  const merges = sheet["!merges"] || [];
  merges.forEach((merge) => {
    const startCell = XLSX.utils.encode_cell(merge.s);
    const startValue = sheet[startCell];
    if (!startValue) return;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!sheet[addr]) sheet[addr] = { ...startValue };
      }
    }
  });
  return merges.length;
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const parts = str.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const num = Number(value);
  if (!isNaN(num) && num > 1000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

function resolveRowSync(
  row: any,
  rowIndex: number,
  cache: Map<string, number>,
  refData: any,
  errors: RowError[]
) {
  const str = (v: any) => String(v || "").trim();
  const rowErrors: string[] = [];
  const number = normalizeLineNumber(row["number"]);

  const providerName = str(row["provider_name"]);
  const provider_id = providerName ? lookupId(cache, "providers", providerName) : null;
  if (!providerName) rowErrors.push(`عمود provider_name فاضي أو ناقص`);
  else if (!provider_id) rowErrors.push(`الشبكة "${providerName}" غير موجودة`);

  const accountNo = str(row["account_no"]);
  const account_id = accountNo && provider_id
    ? cache.get(`accounts:${accountNo.toLowerCase()}_${provider_id}`) ?? null
    : null;

  const almanafizName = str(row["almanafiz_name"]);
  let almanafiz_id: number | null = null;
  let heiaat_id: number | null = null;
  let group_id: number | null = null;
  let department_id: number | null = null;

  if (almanafizName) {
    const foundAlmanafiz = lookupId(cache, "almanafiz", almanafizName);
    if (foundAlmanafiz) {
      almanafiz_id = foundAlmanafiz;
      const found = refData.almanafizData.find((a: any) => a.id === almanafiz_id);
      if (found) {
        group_id = found.group_id;
        department_id = found.groups?.department_id || null;
      }
    } else {
      const foundHeiaat = lookupId(cache, "heiaat", almanafizName);
      if (foundHeiaat) {
        heiaat_id = foundHeiaat;
        const found = refData.heiaatData.find((h: any) => h.id === heiaat_id);
        if (found) group_id = found.group_id;
      } else {
        rowErrors.push(`المنفذ/الهيئة "${almanafizName}" غير موجود في النظام`);
      }
    }
  }

  const agentName = str(row["agent_name"]);
  const agent_id = agentName ? lookupId(cache, "agents", agentName) : null;
  if (!agentName) rowErrors.push(`عمود agent_name فاضي أو ناقص`);
  else if (!agent_id) rowErrors.push(`المندوب "${agentName}" غير موجود`);

  const clientName = getRowField(row, "client_name", "اسم العميل", "name", "الاسم");
  const clientNationalId = getRowField(row, "national_id", "الرقم القومي");
  const clientAddress = getRowField(row, "address", "العنوان");
  let client_id: number | null = null;
  if (clientNationalId) client_id = cache.get(`clients_nid:${clientNationalId.toLowerCase()}`) ?? null;
  if (!client_id && clientName) client_id = cache.get(`clients:${clientName.toLowerCase()}`) ?? null;

  const lineStatusName = str(row["line_status_name"]);
  let line_status_id: number | null = null;
  if (lineStatusName && provider_id) {
    const found = refData.lineStatusesData.find(
      (s: any) => s.name.toLowerCase() === lineStatusName.toLowerCase() && s.provider_id === provider_id
    );
    line_status_id = found?.id ?? null;
    if (!line_status_id) rowErrors.push(`حالة الخط "${lineStatusName}" غير موجودة للشبكة "${providerName}"`);
  }

  const callsPackageName = str(row["calls_package_name"]);
  let calls_package_id: number | null = null;
  if (callsPackageName && provider_id) {
    const found = refData.callsPackagesData.find(
      (p: any) => p.package_name.toLowerCase() === callsPackageName.toLowerCase() && p.provider_id === provider_id
    );
    calls_package_id = found?.id ?? null;
    if (!calls_package_id) rowErrors.push(`باقة المكالمات "${callsPackageName}" غير موجودة`);
  }

  const internetPackageName = str(row["internet_package_name"]);
  let internet_package_id: number | null = null;
  if (internetPackageName && provider_id) {
    const found = refData.internetPackagesData.find(
      (p: any) => p.package_name.toLowerCase() === internetPackageName.toLowerCase() && p.provider_id === provider_id
    );
    internet_package_id = found?.id ?? null;
    if (!internet_package_id) rowErrors.push(`باقة الإنترنت "${internetPackageName}" غير موجودة`);
  }

  const lineExtensionName = str(row["line_extension_name"]);
  let line_extension_id: number | null = null;
  if (lineExtensionName && provider_id) {
    const found = refData.lineExtensionsData.find(
      (p: any) => p.extension_name.toLowerCase() === lineExtensionName.toLowerCase() && p.provider_id === provider_id
    );
    line_extension_id = found?.id ?? null;
    if (!line_extension_id) rowErrors.push(`الإضافة "${lineExtensionName}" غير موجودة`);
  }

  if (rowErrors.length > 0) errors.push({ row: rowIndex + 2, number, errors: rowErrors });

  const hasSim = str(row["has_sim"]);
  const has_sim = hasSim === "true" || hasSim === "1" || hasSim === "نعم";

  return {
    number,
    customer_date_real: parseExcelDate(row["customer_date_real"]),
    serial_number: str(row["serial_number"]) || null,
    note: str(row["note"]) || null,
    report_note: str(row["report_note"]) || null,
    has_sim,
    client_id, provider_id, account_id,
    almanafiz_id, heiaat_id,
    department_id, group_id,
    agent_id, line_status_id,
    calls_package_id, internet_package_id, line_extension_id,
    calls_package_price: Number(row["calls_package_price"] || 0),
    internet_package_price: Number(row["internet_package_price"] || 0),
    line_extension_price: Number(row["line_extension_price"] || 0),
    total_price:
      Number(row["calls_package_price"] || 0) +
      Number(row["internet_package_price"] || 0) +
      Number(row["line_extension_price"] || 0),
    _hasErrors: rowErrors.length > 0,
    _client_name: clientName,
    _client_national_id: clientNationalId,
    _client_address: clientAddress,
  };
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("full");
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  function toggleColumn(key: string) {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  }

  function parseExcel(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const mergeCount = fillMergedCells(sheet);
          if (mergeCount > 0) {
            console.warn(`[parseExcel] لقيت ${mergeCount} خلية مدموجة في الملف — اتعمل fill-down تلقائي لقيمتها على كل الصفوف اللي جواها.`);
          }
          resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[]);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error("فشل قراءة الملف"));
      reader.readAsArrayBuffer(file);
    });
  }

  // جدول العملاء ممكن يبقى فيه عشرات الآلاف من الصفوف — لازم نجيبه على دفعات
  // لأن الاستعلام العادي بيتقطع عند حد افتراضي (غالباً 1000 صف) من غير ما يرجّع خطأ
  async function fetchAllClients(): Promise<{ id: number; name: string; national_id: string | null }[]> {
    let all: { id: number; name: string; national_id: string | null }[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, national_id")
        .range(offset, offset + 999);
      if (error) { console.error(error); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data as any);
      if (data.length < 1000) break;
      offset += 1000;
    }
    return all;
  }

  async function loadReferenceTables() {
    const [
      { data: providers }, { data: almanafiz }, { data: heiaat },
      { data: agents }, clients, { data: lineStatuses },
      { data: callsPackages }, { data: internetPackages }, { data: lineExtensions },
      { data: accounts },
    ] = await Promise.all([
      supabase.from("providers").select("id, name"),
      supabase.from("almanafiz").select("id, name, group_id, groups(id, name, department_id, departments(id, name))"),
      supabase.from("heiaat").select("id, name, group_id"),
      supabase.from("agents").select("id, name"),
      fetchAllClients(),
      supabase.from("line_statuses").select("id, name, provider_id"),
      supabase.from("calls_packages").select("id, package_name, provider_id"),
      supabase.from("internet_packages").select("id, package_name, provider_id"),
      supabase.from("line_extensions").select("id, extension_name, provider_id"),
      supabase.from("accounts").select("id, account_no, provider_id"),
    ]);

    const cache = new Map<string, number>();
    (providers || []).forEach((x) => cache.set(`providers:${x.name.toLowerCase()}`, x.id));
    (almanafiz || []).forEach((x) => cache.set(`almanafiz:${x.name.toLowerCase()}`, x.id));
    (heiaat || []).forEach((x) => cache.set(`heiaat:${x.name.toLowerCase()}`, x.id));
    (agents || []).forEach((x) => cache.set(`agents:${x.name.toLowerCase()}`, x.id));
    (clients || []).forEach((x) => {
      cache.set(`clients:${x.name.toLowerCase()}`, x.id);
      if (x.national_id) cache.set(`clients_nid:${x.national_id.toLowerCase()}`, x.id);
    });
    (accounts || []).forEach((x) =>
      cache.set(`accounts:${x.account_no.toLowerCase()}_${x.provider_id}`, x.id)
    );

    return {
      cache,
      almanafizData: almanafiz || [],
      heiaatData: heiaat || [],
      lineStatusesData: lineStatuses || [],
      callsPackagesData: callsPackages || [],
      internetPackagesData: internetPackages || [],
      lineExtensionsData: lineExtensions || [],
    };
  }

  function downloadErrorsExcel(allErrors: RowError[]) {
    const errorRows = allErrors.flatMap((e) =>
      e.errors.map((err) => ({
        "رقم الصف في الملف": e.row,
        "رقم الخط": e.number,
        "الخطأ": err,
      }))
    );
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import-errors.xlsx");
  }

  async function importData() {
    if (!file) { setResult({ status: "error", message: "اختاري ملف Excel أولاً" }); return; }
    if (importType === "bulk_update" && selectedColumns.length === 0) {
      setResult({ status: "error", message: "اختاري عمود واحد على الأقل" }); return;
    }

    setLoading(true);
    setResult(null);
    setProgressPercent(0);
    setProgressText("جارٍ قراءة الملف...");

    try {
      const rows = await parseExcel(file);

      // ─── استيراد كامل ─────────────────────────────────────
      if (importType === "full") {
        setProgressText("جارٍ تحميل الجداول المرجعية...");
        const refData = await loadReferenceTables();

        setProgressText(`جارٍ معالجة ${rows.length.toLocaleString()} سجل...`);
        const records: any[] = [];
        const allErrors: RowError[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!String(row["number"] || "").trim()) continue;
          const resolved = resolveRowSync(row, i, refData.cache, refData, allErrors);
          records.push(resolved);
          if (i % 2000 === 0) {
            setProgressPercent(Math.round((i / rows.length) * 25));
            setProgressText(`جارٍ معالجة ${i.toLocaleString()} من ${rows.length.toLocaleString()}...`);
            await new Promise(r => setTimeout(r, 0));
          }
        }

        setProgressPercent(25);

        if (allErrors.length > 0) {
          downloadErrorsExcel(allErrors);
          setResult({
            status: "error",
            message: `وُجد ${allErrors.length} صف فيه أخطاء — تم تحميل ملف الأخطاء تلقائياً`,
            details: `إجمالي الأخطاء: ${allErrors.reduce((s, e) => s + e.errors.length, 0)} — صحّحي الأسماء وجربي تاني`,
          });
          setLoading(false);
          return;
        }

        const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
        const clientKeyToData = new Map<string, { name: string; national_id: string | null; address: string | null }>();

        records.forEach(r => {
          if (!r._client_name) return;
          const key = r._client_national_id
            ? `nid:${r._client_national_id.toLowerCase()}`
            : `name:${normalize(r._client_name)}`;
          if (!clientKeyToData.has(key)) {
            clientKeyToData.set(key, {
              name: r._client_name,
              national_id: r._client_national_id || null,
              address: r._client_address || null,
            });
          } else if (r._client_address && !clientKeyToData.get(key)!.address) {
            clientKeyToData.get(key)!.address = r._client_address;
          }
        });

        if (clientKeyToData.size > 0) {
          setProgressText(`جارٍ معالجة ${clientKeyToData.size} عميل...`);
          const allClients = await fetchAllClients();
          const existingByName = new Map<string, number>();
          const existingByNid = new Map<string, number>();
          (allClients || []).forEach(c => {
            existingByName.set(normalize(c.name), c.id);
            if (c.national_id) existingByNid.set(c.national_id.toLowerCase(), c.id);
          });

          const toInsert: { key: string; name: string; national_id: string | null; address: string | null }[] = [];
          const resolvedKeyToId = new Map<string, number>();

          clientKeyToData.forEach((data, key) => {
            if (data.national_id && existingByNid.has(data.national_id.toLowerCase())) {
              resolvedKeyToId.set(key, existingByNid.get(data.national_id.toLowerCase())!);
            } else if (!data.national_id && existingByName.has(normalize(data.name))) {
              resolvedKeyToId.set(key, existingByName.get(normalize(data.name))!);
            } else {
              toInsert.push({ key, ...data });
            }
          });

          if (toInsert.length > 0) {
            for (let i = 0; i < toInsert.length; i += 500) {
              const batch = toInsert.slice(i, i + 500);
              const { data: created, error } = await supabase.from("clients")
                .insert(batch.map(b => ({
                  name: b.name,
                  national_id: b.national_id,
                  address: b.address,
                })))
                .select("id, name, national_id");

              if (error) {
                console.error("Insert clients error:", error.message);
                // فيه صف واحد اتعارض (سباق مع عملية تانية مثلاً) وخلّى الدفعة كلها ترفض —
                // نرفع كل صف لوحده عشان الصفوف السليمة متضيعش
                for (const b of batch) {
                  const { data: single, error: singleErr } = await supabase.from("clients")
                    .insert({ name: b.name, national_id: b.national_id, address: b.address })
                    .select("id, name, national_id")
                    .single();
                  if (!singleErr && single) {
                    resolvedKeyToId.set(b.key, single.id);
                  } else if (b.national_id) {
                    // اتعارض على national_id — يبقى العميل ده موجود بالفعل، جيبي الـ id بتاعه
                    const { data: existing } = await supabase.from("clients")
                      .select("id").eq("national_id", b.national_id).maybeSingle();
                    if (existing) resolvedKeyToId.set(b.key, existing.id);
                  }
                }
                continue;
              }

              (created || []).forEach((c, idx) => {
                const originalKey = batch[idx].key;
                resolvedKeyToId.set(originalKey, c.id);
              });
            }
          }

          records.forEach(r => {
            if (!r._client_name) return;
            const key = r._client_national_id
              ? `nid:${r._client_national_id.toLowerCase()}`
              : `name:${normalize(r._client_name)}`;
            r.client_id = resolvedKeyToId.get(key) ?? null;
          });
        }

        setProgressPercent(35);

        const newAccounts = [...new Map(
          records
            .filter((r) => r.account_no && r.provider_id && !r.account_id)
            .map((r) => [`${r.account_no}_${r.provider_id}`, { account_no: r.account_no, provider_id: r.provider_id }])
        ).values()];

        if (newAccounts.length > 0) {
          setProgressText(`جارٍ إضافة ${newAccounts.length} أكونت جديد...`);
          const { data: createdAccounts } = await supabase
            .from("accounts").insert(newAccounts).select("id, account_no, provider_id");
          (createdAccounts || []).forEach((a) => {
            records.forEach((r) => {
              if (r.account_no === a.account_no && r.provider_id === a.provider_id)
                r.account_id = a.id;
            });
          });
        }

        setProgressPercent(40);

        const unique = Array.from(new Map(records.map((r) => [r.number, r])).values())
          .map(({ _hasErrors, _client_name, _client_national_id, _client_address, ...rest }) => rest);
        const dupes = records.length - unique.length;

        setProgressText(`جارٍ رفع ${unique.length.toLocaleString()} سجل...`);
        for (let i = 0; i < unique.length; i += 500) {
          const batch = unique.slice(i, i + 500);
          const { error } = await supabase.from("lines").upsert(batch, { onConflict: "number" });
          if (error) throw new Error(error.message);
          const done = Math.min(i + 500, unique.length);
          setProgressPercent(40 + Math.round((done / unique.length) * 60));
          setProgressText(`تم رفع ${done.toLocaleString()} من ${unique.length.toLocaleString()} سجل...`);
        }

        setResult({
          status: "success",
          message: "تم الاستيراد بنجاح ✅",
          details: `إجمالي: ${records.length.toLocaleString()} | فريدة: ${unique.length.toLocaleString()} | مكررة: ${dupes}`,
        });
      }

      // ─── تغيير مجمع ───────────────────────────────────────
      else if (importType === "bulk_update") {
        const NAME_COLS = [
          "provider_name", "almanafiz_name", "agent_name", "line_status_name",
          "calls_package_name", "internet_package_name", "line_extension_name", "account_no",
        ];
        const CLIENT_COLS = ["client_name", "national_id", "address"];
        const hasNameCols = selectedColumns.some((c) => NAME_COLS.includes(c));
        const hasClientCols = selectedColumns.some((c) => CLIENT_COLS.includes(c));

        let refData: any = null;
        if (hasNameCols) {
          setProgressText("جارٍ تحميل الجداول المرجعية...");
          refData = await loadReferenceTables();

          setProgressText(`جارٍ التحقق من ${rows.length.toLocaleString()} سجل...`);
          const allErrors: RowError[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!normalizeLineNumber(row["number"])) continue;
            resolveRowSync(row, i, refData.cache, refData, allErrors);
            if (i % 2000 === 0) {
              setProgressPercent(Math.round((i / rows.length) * 30));
              await new Promise(r => setTimeout(r, 0));
            }
          }
          if (allErrors.length > 0) {
            downloadErrorsExcel(allErrors);
            setResult({
              status: "error",
              message: `وُجد ${allErrors.length} صف فيه أخطاء — تم تحميل ملف الأخطاء`,
              details: `صحّحي الأسماء وجربي تاني`,
            });
            setLoading(false);
            return;
          }
        }

        const clientIdMap = new Map<string, number>();
        if (hasClientCols) {
          setProgressText("جارٍ تحميل بيانات العملاء...");
          const allNumbers = rows.map(r => normalizeLineNumber(r["number"])).filter(Boolean);
          for (let i = 0; i < allNumbers.length; i += 1000) {
            const { data } = await supabase
              .from("lines")
              .select("number, client_id")
              .in("number", allNumbers.slice(i, i + 1000));
            (data || []).forEach((l: any) => {
              if (l.client_id) clientIdMap.set(l.number, l.client_id);
            });
          }
        }

        setProgressText(`جارٍ تحديث ${rows.length.toLocaleString()} سجل...`);
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          await Promise.all(batch.map(async (row) => {
            const number = normalizeLineNumber(row["number"]);
            if (!number) return;
            const updates: Record<string, any> = {};
            if (hasNameCols) {
              const resolved = resolveRowSync(row, 0, refData.cache, refData, []);
              for (const col of selectedColumns) {
                switch (col) {
                  case "provider_name": updates.provider_id = resolved.provider_id; break;
                  case "account_no": updates.account_id = resolved.account_id; break;
                  case "almanafiz_name":
                    updates.almanafiz_id = resolved.almanafiz_id;
                    updates.heiaat_id = resolved.heiaat_id;
                    updates.group_id = resolved.group_id;
                    updates.department_id = resolved.department_id;
                    break;
                  case "agent_name": updates.agent_id = resolved.agent_id; break;
                  case "line_status_name": updates.line_status_id = resolved.line_status_id; break;
                  case "calls_package_name": updates.calls_package_id = resolved.calls_package_id; break;
                  case "internet_package_name": updates.internet_package_id = resolved.internet_package_id; break;
                  case "line_extension_name": updates.line_extension_id = resolved.line_extension_id; break;
                  case "calls_package_price": updates.calls_package_price = Number(row[col] || 0); break;
                  case "internet_package_price": updates.internet_package_price = Number(row[col] || 0); break;
                  case "line_extension_price": updates.line_extension_price = Number(row[col] || 0); break;
                  case "has_sim": {
                    const v = String(row[col] || "").trim();
                    updates.has_sim = v === "true" || v === "1" || v === "نعم";
                    break;
                  }
                  case "client_name":
                  case "national_id":
                  case "address":
                    break;
                  default: updates[col] = row[col] || null;
                }
              }
            } else {
              for (const col of selectedColumns) {
                if (!CLIENT_COLS.includes(col)) updates[col] = row[col] || null;
              }
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from("lines").update(updates).eq("number", number);
            }

            if (hasClientCols) {
              const clientFields: Record<string, any> = {};
              const rowClientName = getRowField(row, "client_name", "اسم العميل", "name", "الاسم");
              const rowNationalId = getRowField(row, "national_id", "الرقم القومي");
              const rowAddress = getRowField(row, "address", "العنوان");
              if (selectedColumns.includes("client_name") && rowClientName)
                clientFields.name = rowClientName;
              if (selectedColumns.includes("national_id") && rowNationalId)
                clientFields.national_id = rowNationalId;
              if (selectedColumns.includes("address") && rowAddress)
                clientFields.address = rowAddress;

              if (Object.keys(clientFields).length > 0) {
                const clientId = clientIdMap.get(number);
                if (clientId) {
                  if (clientFields.national_id) {
                    await supabase
                      .from("clients")
                      .update({ national_id: null })
                      .eq("national_id", clientFields.national_id)
                      .neq("id", clientId);
                  }
                  await supabase.from("clients").update(clientFields).eq("id", clientId);
                }
              }
            }
          }));
          setProgressPercent(Math.round(((i + 500) / rows.length) * 100));
          setProgressText(`تم تحديث ${Math.min(i + 500, rows.length).toLocaleString()} من ${rows.length.toLocaleString()}...`);
        }

        setResult({
          status: "success",
          message: "تم التحديث المجمع بنجاح ✅",
          details: `تم تحديث ${rows.length.toLocaleString()} سجل`,
        });
      }

      // ─── إلغاء مجمع (حذف كامل) ───────────────────────────
      else if (importType === "bulk_delete") {
        const numbers = rows.map((r) => String(r["number"] || "").trim()).filter(Boolean);
        setProgressText(`جارٍ حفظ بيانات ${numbers.length} خط في السجل...`);

        const { data: existingLines, error: fetchError } = await supabase
          .from("lines")
          .select("number, client_id, almanafiz_id, clients(name, national_id, address), almanafiz(name)")
          .in("number", numbers);

        if (fetchError) throw new Error(fetchError.message);

        const now = new Date().toISOString();
        const historyRecords = (existingLines ?? []).map((line: any) => ({
          number: line.number,
          customer_name: line.clients?.name || null,
          national_id: line.clients?.national_id || null,
          address: line.clients?.address || null,
          almanafiz: line.almanafiz?.name || null,
          action_type: "cancelled",
          action_date: now,
        }));

        if (historyRecords.length > 0) {
          const { error } = await supabase.from("history").insert(historyRecords);
          if (error) throw new Error(error.message);
        }

        setProgressText(`جارٍ إلغاء ${numbers.length} خط...`);
        for (let i = 0; i < numbers.length; i += 500) {
          const batch = numbers.slice(i, i + 500);
          const { error } = await supabase.from("lines").update({
            client_id: null, almanafiz_id: null, heiaat_id: null,
            department_id: null, group_id: null, account_id: null, is_deleted: true,
          }).in("number", batch);
          if (error) throw new Error(error.message);
          setProgressPercent(Math.round((Math.min(i + 500, numbers.length) / numbers.length) * 100));
        }

        setResult({
          status: "success",
          message: "تم الإلغاء المجمع بنجاح ✅",
          details: `تم إلغاء ${numbers.length} خط وحفظ ${historyRecords.length} سجل في التاريخ`,
        });
      }

      // ─── Deactivate مجمع (زي زرار Deactive الفردي بس على مجموعة أرقام) ───
      else if (importType === "bulk_deactivate") {
        const numbers = rows.map((r) => String(r["number"] || "").trim()).filter(Boolean);
        setProgressText(`جارٍ جلب بيانات ${numbers.length} خط...`);

        const nowIso = new Date().toISOString();
        const userName = localStorage.getItem("full_name") || "Unknown";

        let deactivatedCount = 0;
        let notFoundCount = 0;
        let alreadyDeactiveCount = 0;

        for (let i = 0; i < numbers.length; i += 300) {
          const batchNumbers = numbers.slice(i, i + 300);

          // جيبي بيانات الخطوط الحالية (قبل المسح) في batch
          const { data: existingLines, error: fetchError } = await supabase
            .from("lines")
            .select("id, number, client_id, almanafiz_id, heiaat_id, customer_date_real, is_deactive, clients(name, national_id, address), almanafiz(name), heiaat(name)")
            .in("number", batchNumbers);

          if (fetchError) throw new Error(fetchError.message);

          const foundNumbers = new Set((existingLines || []).map((l: any) => l.number));
          notFoundCount += batchNumbers.filter((n) => !foundNumbers.has(n)).length;

          const toProcess = (existingLines || []).filter((l: any) => !l.is_deactive);
          alreadyDeactiveCount += (existingLines || []).filter((l: any) => l.is_deactive).length;

          if (toProcess.length === 0) {
            setProgressPercent(Math.round((Math.min(i + 300, numbers.length) / numbers.length) * 100));
            continue;
          }

          // حضّري سجلات history + audit_logs
          const historyRecords = toProcess.map((line: any) => ({
            number: line.number,
            customer_name: line.clients?.name || null,
            national_id: line.clients?.national_id || null,
            address: line.clients?.address || null,
            almanafiz: line.almanafiz?.name || line.heiaat?.name || null,
            action_type: "deactivated",
            action_date: nowIso,
          }));

          const auditRecords = toProcess.map((line: any) => ({
            user_name: userName,
            action_type: "DEACTIVATE",
            table_name: "lines",
            record_id: String(line.id),
            old_data: {
              client: { old: line.clients?.name || "—", new: "—" },
              almanafiz: { old: line.almanafiz?.name || line.heiaat?.name || "—", new: "—" },
              customer_date: { old: line.customer_date_real || "—", new: "—" },
            },
          }));

          if (historyRecords.length > 0) {
            const { error } = await supabase.from("history").insert(historyRecords);
            if (error) throw new Error(error.message);
          }
          if (auditRecords.length > 0) {
            const { error } = await supabase.from("audit_logs").insert(auditRecords);
            if (error) throw new Error(error.message);
          }

          // حدّثي كل خط بالمدة الصحيحة بتاعته (durationDays بيختلف حسب customer_date_real)
          await Promise.all(toProcess.map(async (line: any) => {
            let durationDays: number | null = null;
            if (line.customer_date_real) {
              const customerDate = new Date(line.customer_date_real);
              const diffMs = new Date(nowIso).getTime() - customerDate.getTime();
              durationDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            }
            await supabase.from("lines").update({
              client_id: null,
              almanafiz_id: null,
              heiaat_id: null,
              customer_date_real: null,
              is_deactive: true,
              deactive_date: nowIso,
              active_duration_days: durationDays,
            }).eq("id", line.id);
          }));

          deactivatedCount += toProcess.length;
          setProgressPercent(Math.round((Math.min(i + 300, numbers.length) / numbers.length) * 100));
          setProgressText(`تم إلغاء تفعيل ${deactivatedCount.toLocaleString()} من ${numbers.length.toLocaleString()}...`);
        }

        setResult({
          status: "success",
          message: "تم إلغاء تفعيل الخطوط بنجاح ✅",
          details: `تم إلغاء التفعيل: ${deactivatedCount} | ملغاة بالفعل: ${alreadyDeactiveCount} | غير موجودة: ${notFoundCount}`,
        });
      }

      // ─── رفع عمود جديد ────────────────────────────────────
      else if (importType === "add_column") {
        setProgressText("جارٍ تحميل الجداول المرجعية...");
        const refData = await loadReferenceTables();

        setProgressText(`جارٍ معالجة ${rows.length.toLocaleString()} سجل...`);
        const allErrors: RowError[] = [];
        const records: any[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!normalizeLineNumber(row["number"])) continue;
          const resolved = resolveRowSync(row, i, refData.cache, refData, allErrors);
          records.push(resolved);
          if (i % 2000 === 0) {
            setProgressPercent(Math.round((i / rows.length) * 30));
            await new Promise(r => setTimeout(r, 0));
          }
        }

        if (allErrors.length > 0) {
          downloadErrorsExcel(allErrors);
          setResult({
            status: "error",
            message: `وُجد ${allErrors.length} صف فيه أخطاء — تم تحميل ملف الأخطاء`,
            details: `صحّحي الأسماء وجربي تاني`,
          });
          setLoading(false);
          return;
        }

        setProgressText(`جارٍ رفع البيانات لـ ${records.length.toLocaleString()} سجل...`);
        for (let i = 0; i < records.length; i += 100) {
          const batch = records.slice(i, i + 100);
          await Promise.all(batch.map(async (resolved) => {
            const { number: num, _hasErrors, _client_name, _client_national_id, _client_address, ...rest } = resolved;
            const cleanUpdates = Object.fromEntries(
              Object.entries(rest).filter(([, v]) => v !== null && v !== "" && v !== 0)
            );
            await supabase.from("lines").update(cleanUpdates).eq("number", num);
          }));
          setProgressPercent(30 + Math.round(((i + 100) / records.length) * 70));
          setProgressText(`تم رفع ${Math.min(i + 100, records.length).toLocaleString()} من ${records.length.toLocaleString()}...`);
        }

        setResult({
          status: "success",
          message: "تم رفع البيانات بنجاح ✅",
          details: `تم تحديث ${records.length.toLocaleString()} سجل`,
        });
      }

      // ─── تحديث بيانات العملاء ─────────────────────────────
      else if (importType === "update_clients") {
        setProgressText(`جارٍ جلب بيانات الخطوط...`);

        // ─── الخطوة 1: جيبي client_id لكل رقم خط موجود في الشيت ───
        const numbersInSheet = [...new Set(
          rows.map((r) => normalizeLineNumber(r["number"])).filter(Boolean)
        )];
        const lineInfoByNumber = new Map<string, { client_id: number | null }>();
        for (let i = 0; i < numbersInSheet.length; i += 1000) {
          const { data, error } = await supabase
            .from("lines")
            .select("number, client_id")
            .in("number", numbersInSheet.slice(i, i + 1000));
          if (error) { console.error(error); continue; }
          (data || []).forEach((l: any) => lineInfoByNumber.set(l.number, { client_id: l.client_id }));
        }

        // ─── الخطوة 2: للخطوط اللي من غير عميل — جهزّي بيانات عميل جديد لكل واحد ───
        const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
        const newClientKeyToData = new Map<string, { name: string; national_id: string | null; address: string | null }>();
        const numberToNewClientKey = new Map<string, string>();

        rows.forEach((row) => {
          const number = normalizeLineNumber(row["number"]);
          if (!number) return;
          const lineInfo = lineInfoByNumber.get(number);
          if (!lineInfo || lineInfo.client_id) return; // الخط مش موجود، أو عنده عميل بالفعل

          const clientName = getRowField(row, "client_name", "اسم العميل", "name", "الاسم");
          const nationalId = getRowField(row, "national_id", "الرقم القومي");
          const address = getRowField(row, "address", "العنوان");
          if (!clientName) return; // مفيش اسم نعمل بيه عميل جديد

          const key = nationalId ? `nid:${nationalId.toLowerCase()}` : `name:${normalize(clientName)}`;
          if (!newClientKeyToData.has(key)) {
            newClientKeyToData.set(key, { name: clientName, national_id: nationalId || null, address: address || null });
          } else if (address && !newClientKeyToData.get(key)!.address) {
            newClientKeyToData.get(key)!.address = address;
          }
          numberToNewClientKey.set(number, key);
        });

        // ─── الخطوة 3: قارني بعملاء موجودين بالفعل بالرقم القومي قبل إنشاء جديد ───
        const keyToClientId = new Map<string, number>();
        let created = 0;
        if (newClientKeyToData.size > 0) {
          setProgressText(`جارٍ التحقق من ${newClientKeyToData.size} عميل جديد...`);
          const allClients = await fetchAllClients();
          const existingByNid = new Map<string, number>();
          allClients.forEach((c) => { if (c.national_id) existingByNid.set(c.national_id.toLowerCase(), c.id); });

          const toCreate: { key: string; name: string; national_id: string | null; address: string | null }[] = [];
          newClientKeyToData.forEach((data, key) => {
            if (data.national_id && existingByNid.has(data.national_id.toLowerCase())) {
              keyToClientId.set(key, existingByNid.get(data.national_id.toLowerCase())!);
            } else {
              toCreate.push({ key, ...data });
            }
          });

          for (let i = 0; i < toCreate.length; i += 500) {
  const batch = toCreate.slice(i, i + 500);
  const withNid = batch.filter((b) => b.national_id);
  const withoutNid = batch.filter((b) => !b.national_id);

  // ─── اللي عندهم رقم قومي: upsert — لو موجود يتحدث، لو مش موجود يتعمل ───
  if (withNid.length > 0) {
  // بناخد الـ IDs من رجوع الـ upsert نفسه (مش استعلام SELECT منفصل) — عشان لو فيه
  // RLS policy على clients بتقيّد SELECT بشكل مختلف عن INSERT/UPDATE، هنشوف الفرق
  // فوراً بدل ما الصفوف دي تختفي بصمت من غير أي تفسير
  const { data: upserted, error } = await supabase.from("clients")
    .upsert(
      withNid.map((b) => ({ name: b.name, national_id: b.national_id, address: b.address })),
      { onConflict: "national_id" }
    )
    .select("id, national_id");

  if (error) {
    console.error("Upsert clients error:", error.message);
  } else if (!upserted || upserted.length !== withNid.length) {
    console.warn(
      `[update_clients] الـ upsert رجّع ${upserted?.length ?? 0} صف بس من أصل ${withNid.length} ` +
      `المفروض يتعملهم upsert — الاحتمال الأكبر إن فيه RLS policy على SELECT لجدول clients ` +
      `أضيق من policy الـ INSERT/UPDATE، فالصف اتكتب فعلاً بس السيشن الحالية مش شايفاه.`,
      {
        اللي_المفروض_يرجع: withNid.map((b) => b.national_id),
        اللي_رجع_فعلاً: (upserted || []).map((c) => c.national_id),
      }
    );
    const idByNid = new Map<string, number>();
    (upserted || []).forEach((c) => { if (c.national_id) idByNid.set(c.national_id, c.id); });
    withNid.forEach((b) => {
      if (!b.national_id) return;
      const id = idByNid.get(b.national_id);
      if (id) { keyToClientId.set(b.key, id); created++; }
    });
  } else {
    upserted.forEach((c, idx) => {
      keyToClientId.set(withNid[idx].key, c.id);
      created++;
    });
  }
}

  // ─── اللي من غير رقم قومي: إضافة عادية (مفيش تعارض ممكن يحصل) ───
  if (withoutNid.length > 0) {
    const { data, error } = await supabase.from("clients")
      .insert(withoutNid.map((b) => ({ name: b.name, national_id: null, address: b.address })))
      .select("id");
    if (!error) {
      (data || []).forEach((c, idx) => { keyToClientId.set(withoutNid[idx].key, c.id); created++; });
    }
  }
}
        }

        // ─── الخطوة 4: اربطي كل خط بعميله (موجود أو جديد) وحدّثي بياناته ───
        let updated = 0;
        let linked = 0;
        let lineNotFound = 0;
        let noClientCreated = 0;
        let noUpdates = 0;
        const noClientCreatedDetails: any[] = [];
        const rawSamples: any[] = [];

        setProgressText(`جارٍ تحديث ${rows.length.toLocaleString()} سجل...`);
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);

          await Promise.all(batch.map(async (row) => {
            const number = normalizeLineNumber(row["number"]);
            if (!number) return;

            const lineInfo = lineInfoByNumber.get(number);
            if (!lineInfo) { lineNotFound++; return; }

            let clientId = lineInfo.client_id;

            if (!clientId) {
              const newKey = numberToNewClientKey.get(number);
              const resolvedId = newKey ? keyToClientId.get(newKey) : undefined;
              if (!resolvedId) {
                noClientCreated++;
                noClientCreatedDetails.push({
                  رقم_الخط: number,
                  اسم_العميل_بالشيت: getRowField(row, "client_name", "اسم العميل", "name", "الاسم"),
                  الرقم_القومي_بالشيت: getRowField(row, "national_id", "الرقم القومي"),
                  المفتاح_المتوقع: newKey ?? "(مفيش اسم/رقم قومي في الصف أصلاً)",
                  اتحل_في_الخطوة_3: newKey ? keyToClientId.has(newKey) : false,
                });
                if (rawSamples.length < 5) rawSamples.push(row);
                return;
              }
              await supabase.from("lines").update({ client_id: resolvedId }).eq("number", number);
              clientId = resolvedId;
              linked++;
            }

            const updates: Record<string, any> = {};
            const clientName = getRowField(row, "client_name", "اسم العميل", "name", "الاسم");
            const nationalId = getRowField(row, "national_id", "الرقم القومي");
            const address = getRowField(row, "address", "العنوان");

            if (clientName) updates.name = clientName;
            if (nationalId) updates.national_id = nationalId;
            if (address) updates.address = address;

            if (Object.keys(updates).length === 0) { noUpdates++; return; }

            await supabase.from("clients").update(updates).eq("id", clientId);
            updated++;
          }));

          setProgressPercent(Math.round(((i + 100) / rows.length) * 100));
          setProgressText(`تم معالجة ${Math.min(i + 100, rows.length).toLocaleString()} من ${rows.length.toLocaleString()}...`);
        }

        if (noClientCreatedDetails.length > 0) {
          console.warn(`[update_clients] ${noClientCreatedDetails.length} خط فضل من غير عميل — التفاصيل:`);
          console.table(noClientCreatedDetails);
        }

        setResult({
          status: "success",
          message: "تم تحديث بيانات العملاء بنجاح ✅",
          details: `تم تحديث: ${updated} | عملاء جدد اتعملوا: ${created} | خطوط اترّبطت بعميل جديد/موجود: ${linked} | رقم الخط مش موجود بالنظام: ${lineNotFound} | خط من غير عميل ومفيش اسم بالشيت نعمل بيه عميل: ${noClientCreated} | بدون تغيير: ${noUpdates}`,
          debugColumns: rows.length > 0 ? Object.keys(rows[0]) : [],
          debugRows: rawSamples,
        });
      }

    } catch (err) {
      setResult({
        status: "error",
        message: "خطأ غير متوقع",
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  if (!authorized) return null;

  const operations = [
    { key: "full" as ImportType, icon: <FileSpreadsheet className="w-4 h-4" />, title: "استيراد كامل", desc: "رفع كل بيانات الخطوط بالأسماء" },
    { key: "bulk_update" as ImportType, icon: <RefreshCw className="w-4 h-4" />, title: "تغيير مجمع", desc: "تحديث أعمدة محددة لخطوط موجودة" },
    { key: "bulk_deactivate" as ImportType, icon: <Ban className="w-4 h-4" />, title: "Deactivate مجمع", desc: "إلغاء تفعيل خطوط (زي زرار Deactive) مع الاحتفاظ بالقسم والجروب" },
    { key: "bulk_delete" as ImportType, icon: <Trash2 className="w-4 h-4" />, title: "إلغاء مجمع", desc: "تعليم خطوط كمحذوفة (يمسح القسم والجروب والأكونت)" },
    { key: "add_column" as ImportType, icon: <PlusCircle className="w-4 h-4" />, title: "رفع عمود جديد", desc: "إضافة بيانات عمود لخطوط موجودة" },
    { key: "update_clients" as ImportType, icon: <User className="w-4 h-4" />, title: "تحديث بيانات العملاء", desc: "تحديث الاسم والرقم القومي والعنوان" },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Database className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">استيراد البيانات</h1>
            <p className="text-sm text-slate-500 mt-0.5">إجراءات مجمعة على بيانات الخطوط</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">نوع الإجراء</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {operations.map((op) => (
                <button key={op.key} type="button" disabled={loading}
                  onClick={() => { setImportType(op.key); setResult(null); setFile(null); setSelectedColumns([]); }}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-right transition disabled:opacity-50 ${
                    importType === op.key
                      ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    importType === op.key ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {op.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{op.title}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{op.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {importType === "bulk_update" && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">الأعمدة المراد تحديثها</label>
              <div className="relative">
                <button type="button" onClick={() => setColDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white hover:border-slate-300 transition">
                  <span className="text-slate-600">
                    {selectedColumns.length === 0 ? "اختاري الأعمدة..." : `${selectedColumns.length} عمود محدد`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${colDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {colDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {UPDATABLE_COLUMNS.map((col) => (
                      <label key={col.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={selectedColumns.includes(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-slate-300 text-blue-500" />
                        <span className="text-sm text-slate-700">{col.label}</span>
                        <span className="text-xs text-slate-400 mr-auto font-mono">{col.key}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedColumns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedColumns.map((col) => (
                    <span key={col} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                      {UPDATABLE_COLUMNS.find((c) => c.key === col)?.label}
                      <button onClick={() => toggleColumn(col)} className="hover:text-blue-900">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">ملف Excel</label>
            <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition ${
              file ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-blue-300 bg-slate-50"
            }`}>
              <FileSpreadsheet className={`w-5 h-5 shrink-0 ${file ? "text-green-600" : "text-slate-400"}`} />
              <span className={`text-sm ${file ? "text-green-700 font-medium" : "text-slate-400"}`}>
                {file ? file.name : "اضغطي هنا لاختيار ملف .xlsx أو .xls"}
              </span>
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
            </label>
            <div className="mt-2 text-xs text-slate-400">
              {importType === "full" && (
                <p>الأعمدة: <span className="font-mono">number, provider_name, account_no, almanafiz_name, agent_name, client_name, national_id, address, line_status_name, calls_package_name, internet_package_name, line_extension_name, calls_package_price, internet_package_price, line_extension_price, has_sim, serial_number, customer_date_real, note, report_note</span></p>
              )}
              {importType === "bulk_update" && <p>الأعمدة: <span className="font-mono">number</span> + الأعمدة المحددة فوق</p>}
              {importType === "bulk_delete" && <p>الأعمدة: <span className="font-mono">number</span> فقط</p>}
              {importType === "bulk_deactivate" && (
                <p>الأعمدة: <span className="font-mono">number</span> فقط — هيمسح العميل والمنفذ وتاريخ العميل، ويحتفظ بالقسم والجروب والأكونت، ويسجل التاريخ والمدة للعمولة</p>
              )}
              {importType === "add_column" && <p>الأعمدة: <span className="font-mono">number</span> + العمود الجديد بالاسم</p>}
              {importType === "update_clients" && (
                <p>الأعمدة: <span className="font-mono">number</span> + <span className="font-mono">client_name</span> (اختياري) + <span className="font-mono">national_id</span> (اختياري) + <span className="font-mono">address</span> (اختياري)</p>
              )}
            </div>
          </div>

          <button onClick={importData} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3.5 font-medium transition">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ التنفيذ...</>
              : <><Download className="w-4 h-4" />تنفيذ الإجراء</>}
          </button>

          {loading && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>{progressText}</span>
                {progressPercent > 0 && <span>{progressPercent}%</span>}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: progressPercent > 0 ? `${progressPercent}%` : "5%" }} />
              </div>
            </div>
          )}

          {result && !loading && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              result.status === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}>
              {result.status === "success"
                ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-semibold ${result.status === "success" ? "text-green-700" : "text-red-700"}`}>
                  {result.message}
                </p>
                {result.details && (
                  <p className={`text-xs mt-1 ${result.status === "success" ? "text-green-600" : "text-red-600"}`}>
                    {result.details}
                  </p>
                )}

                {result.debugColumns && result.debugColumns.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="font-semibold text-slate-600">الأعمدة اللي اتقرأت فعلياً من الملف:</p>
                    <p className="text-slate-500 mt-0.5 font-mono">{result.debugColumns.join("، ")}</p>
                  </div>
                )}

                {result.debugRows && result.debugRows.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="font-semibold text-slate-600">
                      عينة من الصفوف اللي فشلت (أول {result.debugRows.length}) — البيانات الخام زي ما اتقرأت من الملف:
                    </p>
                    <div className="mt-1 space-y-2 max-h-72 overflow-y-auto">
                      {result.debugRows.map((r, i) => (
                        <pre key={i} className="bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-700 overflow-x-auto" dir="ltr">
                          {JSON.stringify(r, null, 2)}
                        </pre>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 mt-4 text-xs text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            الأسماء لازم تكون مطابقة للموجود في قاعدة البيانات — لو في اسم غلط هيتنزل ملف Excel بكل الأخطاء.
          </span>
        </div>
      </div>
    </div>
  );
}