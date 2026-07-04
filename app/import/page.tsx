"use client";

import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download, FileSpreadsheet, Trash2, RefreshCw, PlusCircle,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Database, ChevronDown,
} from "lucide-react";

type ImportType = "full" | "bulk_update" | "bulk_delete" | "add_column";

interface ImportResult {
  status: "success" | "error";
  message: string;
  details?: string;
}

interface RowError {
  row: number;
  number: string;
  errors: string[];
}

const UPDATABLE_COLUMNS: { key: string; label: string }[] = [
  { key: "account_no", label: "رقم الأكونت (اسم)" },
  { key: "customer_date_real", label: "تاريخ العميل" },
  { key: "serial_number", label: "الرقم التسلسلي" },
  { key: "note", label: "ملاحظة" },
  { key: "report_note", label: "ملاحظة التقرير" },
  { key: "provider_name", label: "الشبكة (اسم)" },
  { key: "almanafiz_name", label: "المنفذ (اسم)" },
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

// ─── Lookup من cache ──────────────────────────────────────────
function lookupId(cache: Map<string, number>, table: string, name: string): number | null {
  if (!name?.trim()) return null;
  return cache.get(`${table}:${name.trim().toLowerCase()}`) ?? null;
}

// ─── resolveRow ───────────────────────────────────────────────
async function resolveRow(
  row: any,
  rowIndex: number,
  cache: Map<string, number>,
  refData: any,
  errors: RowError[]
) {
  const str = (v: any) => String(v || "").trim();
  const rowErrors: string[] = [];
  const number = str(row["number"]);

  // Provider
  const providerName = str(row["provider_name"]);
  const provider_id = providerName ? lookupId(cache, "providers", providerName) : null;
  if (providerName && !provider_id)
    rowErrors.push(`الشبكة "${providerName}" غير موجودة`);

  // Account — بيتطابق بـ account_no + provider_id
  const accountNo = str(row["account_no"]);
  let account_id: number | null = null;
  if (accountNo && provider_id) {
    const cacheKey = `accounts:${accountNo.toLowerCase()}_${provider_id}`;
    if (cache.has(cacheKey)) {
      account_id = cache.get(cacheKey)!;
    } else {
      const { data: foundAcc } = await supabase
        .from("accounts")
        .select("id")
        .eq("account_no", accountNo)
        .eq("provider_id", provider_id)
        .single();
      if (foundAcc) {
        account_id = foundAcc.id;
        cache.set(cacheKey, foundAcc.id);
      } else {
        // أنشئه أوتو
        const { data: created } = await supabase
          .from("accounts")
          .insert({ account_no: accountNo, provider_id })
          .select("id")
          .single();
        if (created) {
          account_id = created.id;
          cache.set(cacheKey, created.id);
        }
      }
    }
  }

  // Almanafiz
  const almanafizName = str(row["almanafiz_name"]);
  const almanafiz_id = almanafizName ? lookupId(cache, "almanafiz", almanafizName) : null;
  if (almanafizName && !almanafiz_id)
    rowErrors.push(`المنفذ "${almanafizName}" غير موجود`);

  let group_id: number | null = null;
  let department_id: number | null = null;
  if (almanafiz_id) {
    const found = refData.almanafizData.find((a: any) => a.id === almanafiz_id);
    if (found) {
      group_id = found.group_id;
      department_id = found.groups?.department_id || null;
    }
  }

  // Agent
  const agentName = str(row["agent_name"]);
  const agent_id = agentName ? lookupId(cache, "agents", agentName) : null;
  if (agentName && !agent_id)
    rowErrors.push(`المندوب "${agentName}" غير موجود`);

  // Client
  const clientName = str(row["client_name"]);
  let client_id: number | null = null;
  if (clientName) {
    const cached = lookupId(cache, "clients", clientName);
    if (cached) {
      client_id = cached;
    } else {
      const { data: created } = await supabase
        .from("clients")
        .insert({ name: clientName.trim() })
        .select("id")
        .single();
      if (created) {
        client_id = created.id;
        cache.set(`clients:${clientName.trim().toLowerCase()}`, created.id);
      }
    }
  }

  // Line Status
  const lineStatusName = str(row["line_status_name"]);
  let line_status_id: number | null = null;
  if (lineStatusName && provider_id) {
    const found = refData.lineStatusesData.find(
      (s: any) => s.name.toLowerCase() === lineStatusName.toLowerCase() && s.provider_id === provider_id
    );
    line_status_id = found?.id ?? null;
    if (!line_status_id)
      rowErrors.push(`حالة الخط "${lineStatusName}" غير موجودة للشبكة "${providerName}"`);
  }

  // Calls Package
  const callsPackageName = str(row["calls_package_name"]);
  let calls_package_id: number | null = null;
  if (callsPackageName && provider_id) {
    const found = refData.callsPackagesData.find(
      (p: any) => p.package_name.toLowerCase() === callsPackageName.toLowerCase() && p.provider_id === provider_id
    );
    calls_package_id = found?.id ?? null;
    if (!calls_package_id)
      rowErrors.push(`باقة المكالمات "${callsPackageName}" غير موجودة`);
  }

  // Internet Package
  const internetPackageName = str(row["internet_package_name"]);
  let internet_package_id: number | null = null;
  if (internetPackageName && provider_id) {
    const found = refData.internetPackagesData.find(
      (p: any) => p.package_name.toLowerCase() === internetPackageName.toLowerCase() && p.provider_id === provider_id
    );
    internet_package_id = found?.id ?? null;
    if (!internet_package_id)
      rowErrors.push(`باقة الإنترنت "${internetPackageName}" غير موجودة`);
  }

  // Line Extension
  const lineExtensionName = str(row["line_extension_name"]);
  let line_extension_id: number | null = null;
  if (lineExtensionName && provider_id) {
    const found = refData.lineExtensionsData.find(
      (p: any) => p.extension_name.toLowerCase() === lineExtensionName.toLowerCase() && p.provider_id === provider_id
    );
    line_extension_id = found?.id ?? null;
    if (!line_extension_id)
      rowErrors.push(`الإضافة "${lineExtensionName}" غير موجودة`);
  }

  if (rowErrors.length > 0) {
    errors.push({ row: rowIndex + 2, number, errors: rowErrors });
  }

  // has_sim
  const hasSim = str(row["has_sim"]);
  const has_sim = hasSim === "true" || hasSim === "1" || hasSim === "نعم";

  return {
    number,
    account_no: accountNo || null,
    customer_date_real: str(row["customer_date_real"]) || null,
    serial_number: str(row["serial_number"]) || null,
    note: str(row["note"]) || null,
    report_note: str(row["report_note"]) || null,
    has_sim,
    client_id, provider_id, account_id, almanafiz_id,
    department_id, group_id, agent_id, line_status_id,
    calls_package_id, internet_package_id, line_extension_id,
    calls_package_price:    Number(row["calls_package_price"] || 0),
    internet_package_price: Number(row["internet_package_price"] || 0),
    line_extension_price:   Number(row["line_extension_price"] || 0),
    total_price:
      Number(row["calls_package_price"] || 0) +
      Number(row["internet_package_price"] || 0) +
      Number(row["line_extension_price"] || 0),
    _hasErrors: rowErrors.length > 0,
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
          resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[]);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error("فشل قراءة الملف"));
      reader.readAsArrayBuffer(file);
    });
  }

  async function loadReferenceTables() {
    const [
      { data: providers }, { data: almanafiz }, { data: agents },
      { data: clients }, { data: lineStatuses },
      { data: callsPackages }, { data: internetPackages }, { data: lineExtensions },
    ] = await Promise.all([
      supabase.from("providers").select("id, name"),
      supabase.from("almanafiz").select("id, name, group_id, groups(id, name, department_id, departments(id, name))"),
      supabase.from("agents").select("id, name"),
      supabase.from("clients").select("id, name"),
      supabase.from("line_statuses").select("id, name, provider_id"),
      supabase.from("calls_packages").select("id, package_name, provider_id"),
      supabase.from("internet_packages").select("id, package_name, provider_id"),
      supabase.from("line_extensions").select("id, extension_name, provider_id"),
    ]);

    const cache = new Map<string, number>();
    (providers || []).forEach((x) => cache.set(`providers:${x.name.toLowerCase()}`, x.id));
    (almanafiz || []).forEach((x) => cache.set(`almanafiz:${x.name.toLowerCase()}`, x.id));
    (agents || []).forEach((x) => cache.set(`agents:${x.name.toLowerCase()}`, x.id));
    (clients || []).forEach((x) => cache.set(`clients:${x.name.toLowerCase()}`, x.id));

    return {
      cache,
      almanafizData: almanafiz || [],
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

        setProgressText(`جارٍ التحقق من ${rows.length} سجل...`);
        const records: any[] = [];
        const allErrors: RowError[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!String(row["number"] || "").trim()) continue;
          const resolved = await resolveRow(row, i, refData.cache, refData, allErrors);
          records.push(resolved);
          setProgressPercent(Math.round(((i + 1) / rows.length) * 40));
        }

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

        const unique = Array.from(new Map(records.map((r) => [r.number, r])).values())
          .map(({ _hasErrors, ...rest }) => rest);
        const dupes = records.length - unique.length;

        setProgressText(`جارٍ رفع ${unique.length} سجل...`);
        for (let i = 0; i < unique.length; i += 500) {
          const batch = unique.slice(i, i + 500);
          const { error } = await supabase.from("lines").upsert(batch, { onConflict: "number" });
          if (error) throw new Error(error.message);
          const done = Math.min(i + 500, unique.length);
          setProgressPercent(40 + Math.round((done / unique.length) * 60));
          setProgressText(`تم رفع ${done} من ${unique.length} سجل...`);
        }

        setResult({
          status: "success",
          message: "تم الاستيراد بنجاح ✅",
          details: `إجمالي: ${records.length} | فريدة: ${unique.length} | مكررة: ${dupes}`,
        });
      }

      // ─── تغيير مجمع ───────────────────────────────────────
      else if (importType === "bulk_update") {
        setProgressText("جارٍ تحميل الجداول المرجعية...");
        const refData = await loadReferenceTables();

        const NAME_COLS = [
          "provider_name", "almanafiz_name", "agent_name", "line_status_name",
          "calls_package_name", "internet_package_name", "line_extension_name", "account_no",
        ];
        const hasNameCols = selectedColumns.some((c) => NAME_COLS.includes(c));

        if (hasNameCols) {
          setProgressText(`جارٍ التحقق من ${rows.length} سجل...`);
          const allErrors: RowError[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!String(row["number"] || "").trim()) continue;
            await resolveRow(row, i, refData.cache, refData, allErrors);
            setProgressPercent(Math.round(((i + 1) / rows.length) * 30));
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

        setProgressText(`جارٍ تحديث ${rows.length} سجل...`);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const number = String(row["number"] || "").trim();
          if (!number) continue;

          const updates: Record<string, any> = {};

          if (hasNameCols) {
            const resolved = await resolveRow(row, i, refData.cache, refData, []);
            for (const col of selectedColumns) {
              switch (col) {
                case "provider_name":         updates.provider_id = resolved.provider_id; break;
                case "account_no":            updates.account_id = resolved.account_id; break;
                case "almanafiz_name":        updates.almanafiz_id = resolved.almanafiz_id; updates.group_id = resolved.group_id; updates.department_id = resolved.department_id; break;
                case "agent_name":            updates.agent_id = resolved.agent_id; break;
                case "line_status_name":      updates.line_status_id = resolved.line_status_id; break;
                case "calls_package_name":    updates.calls_package_id = resolved.calls_package_id; break;
                case "internet_package_name": updates.internet_package_id = resolved.internet_package_id; break;
                case "line_extension_name":   updates.line_extension_id = resolved.line_extension_id; break;
                case "calls_package_price":   updates.calls_package_price = Number(row[col] || 0); break;
                case "internet_package_price":updates.internet_package_price = Number(row[col] || 0); break;
                case "line_extension_price":  updates.line_extension_price = Number(row[col] || 0); break;
                case "has_sim": {
                  const v = String(row[col] || "").trim();
                  updates.has_sim = v === "true" || v === "1" || v === "نعم";
                  break;
                }
                default: updates[col] = row[col] || null;
              }
            }

            if (selectedColumns.some((c) => ["calls_package_price", "internet_package_price", "line_extension_price"].includes(c))) {
              const { data: existing } = await supabase
                .from("lines")
                .select("calls_package_price, internet_package_price, line_extension_price")
                .eq("number", number).single();
              if (existing) {
                updates.total_price =
                  Number(updates.calls_package_price ?? existing.calls_package_price ?? 0) +
                  Number(updates.internet_package_price ?? existing.internet_package_price ?? 0) +
                  Number(updates.line_extension_price ?? existing.line_extension_price ?? 0);
              }
            }
          } else {
            for (const col of selectedColumns) {
              updates[col] = row[col] || null;
            }
          }

          await supabase.from("lines").update(updates).eq("number", number);
          setProgressPercent(
            hasNameCols
              ? 30 + Math.round(((i + 1) / rows.length) * 70)
              : Math.round(((i + 1) / rows.length) * 100)
          );
        }

        setResult({
          status: "success",
          message: "تم التحديث المجمع بنجاح ✅",
          details: `تم تحديث ${rows.length} سجل`,
        });
      }

      // ─── إلغاء مجمع ───────────────────────────────────────
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
            client_id: null, almanafiz_id: null, department_id: null,
            group_id: null, account_id: null, is_deleted: true,
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

      // ─── رفع عمود جديد ────────────────────────────────────
      else if (importType === "add_column") {
        setProgressText("جارٍ تحميل الجداول المرجعية...");
        const refData = await loadReferenceTables();

        setProgressText(`جارٍ التحقق من ${rows.length} سجل...`);
        const allErrors: RowError[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!String(row["number"] || "").trim()) continue;
          await resolveRow(row, i, refData.cache, refData, allErrors);
          setProgressPercent(Math.round(((i + 1) / rows.length) * 30));
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

        setProgressText(`جارٍ رفع البيانات لـ ${rows.length} سجل...`);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const number = String(row["number"] || "").trim();
          if (!number) continue;

          const resolved = await resolveRow(row, i, refData.cache, refData, []);
          const { number: _, _hasErrors, ...rest } = resolved;
          const cleanUpdates = Object.fromEntries(
            Object.entries(rest).filter(([, v]) => v !== null && v !== "" && v !== 0)
          );

          await supabase.from("lines").update(cleanUpdates).eq("number", number);
          setProgressPercent(30 + Math.round(((i + 1) / rows.length) * 70));
        }

        setResult({
          status: "success",
          message: "تم رفع البيانات بنجاح ✅",
          details: `تم تحديث ${rows.length} سجل`,
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
    { key: "bulk_delete" as ImportType, icon: <Trash2 className="w-4 h-4" />, title: "إلغاء مجمع", desc: "تعليم خطوط كمحذوفة" },
    { key: "add_column" as ImportType, icon: <PlusCircle className="w-4 h-4" />, title: "رفع عمود جديد", desc: "إضافة بيانات عمود لخطوط موجودة" },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
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

          {/* Operation selector */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">نوع الإجراء</label>
            <div className="grid grid-cols-2 gap-3">
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

          {/* Column selector */}
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

          {/* File upload */}
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
                <p>الأعمدة: <span className="font-mono">number, provider_name, account_no, almanafiz_name, agent_name, client_name, line_status_name, calls_package_name, internet_package_name, line_extension_name, calls_package_price, internet_package_price, line_extension_price, has_sim, serial_number, customer_date_real, note, report_note</span></p>
              )}
              {importType === "bulk_update" && <p>الأعمدة: <span className="font-mono">number</span> + الأعمدة المحددة فوق</p>}
              {importType === "bulk_delete" && <p>الأعمدة: <span className="font-mono">number</span> فقط</p>}
              {importType === "add_column" && <p>الأعمدة: <span className="font-mono">number</span> + العمود الجديد بالاسم</p>}
            </div>
          </div>

          {/* Action button */}
          <button onClick={importData} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3.5 font-medium transition">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ التنفيذ...</>
              : <><Download className="w-4 h-4" />تنفيذ الإجراء</>}
          </button>

          {/* Progress */}
          {loading && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>{progressText}</span>
                {progressPercent > 0 && <span>{progressPercent}%</span>}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: progressPercent > 0 ? `${progressPercent}%` : "10%" }} />
              </div>
            </div>
          )}

          {/* Result */}
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