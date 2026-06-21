"use client";

import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  IdCard,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
} from "lucide-react";

type ImportType = "full" | "national_id";

interface ImportResult {
  status: "success" | "error";
  message: string;
  details?: string;
}

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("full");
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const role = localStorage.getItem("role");

    if (!role) {
      router.replace("/login");
      return;
    }

    setAuthorized(true);
  }, []);

  async function importData() {
    setLoading(true);
    setResult(null);
    setProgressPercent(0);
    setProgressText("جارٍ تحميل البيانات من Google Sheet...");

    try {
      const url =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3RIh_S4qeeyhhL084Z3Sp5mkhbArHcq1xwIAd7w6cdIVlsph9OmRWU9nebLMc6l48FXH0JQxJ42ba/pub?output=csv";

      const response = await fetch(url);
      const csv = await response.text();

      const result = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
      });

      const rows = result.data as any[];

      // -------------------------------------------------
      // وضع: تحديث الرقم القومي فقط
      // -------------------------------------------------
      if (importType === "national_id") {
        setProgressText(`جارٍ تحديث الرقم القومي لـ ${rows.length} سجل...`);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          await supabase
            .from("lines")
            .update({
              national_id: row["national_id"],
            })
            .eq("number", row["number"]);

          setProgressPercent(Math.round(((i + 1) / rows.length) * 100));
        }

        setResult({
          status: "success",
          message: "تم تحديث الرقم القومي بنجاح",
          details: `تم تحديث ${rows.length} سجل`,
        });
        setLoading(false);
        return;
      }

      // -------------------------------------------------
      // وضع: استيراد كامل
      // -------------------------------------------------
      const records = rows.map((row) => ({
        number: row["number"]?.trim(),
        account_no: row["Account No"],
        customer_name: row["Customer Name"],
        customer_date: row["Customer date"],

        almanafiz: row["Almanafiz"],

        calls_package: row["Calls Package"],
        calls_package_price: Number(row["Calls Package Price"] || 0),

        internet_package_name: row["Internet Package Name"],
        internet_package_price: Number(row["Internet Package Price"] || 0),

        line_extension_name: row["Line Extension Name"],
        line_extension_price: Number(row["Line Extension Price"] || 0),

        provider_name: row["Provider/Name"],

        note: row["note"],
        report_note: row["Report note"],

        agent_name: row["Agent/sales Name"],

        department: row["Department"],
        group_name: row["Group"],

        total_price:
  Number(row["Calls Package Price"] || 0) +
  Number(row["Internet Package Price"] || 0) +
  Number(row["Line Extension Price"] || 0),
      }));

      const uniqueRecords = Array.from(
        new Map(records.map((item) => [item.number, item])).values()
      );

      const duplicatesCount = records.length - uniqueRecords.length;

      setProgressText(
        `جارٍ رفع ${uniqueRecords.length} سجل فريد (تم تجاهل ${duplicatesCount} مكرر)...`
      );

      for (let i = 0; i < uniqueRecords.length; i += 500) {
        const batch = uniqueRecords.slice(i, i + 500);

        const { error } = await supabase.from("lines").upsert(batch, {
          onConflict: "number",
        });

        if (error) {
          setResult({
            status: "error",
            message: `حصل خطأ عند رفع الدفعة رقم ${i}`,
            details: error.message,
          });
          setLoading(false);
          return;
        }

        const uploaded = Math.min(i + 500, uniqueRecords.length);
        setProgressPercent(Math.round((uploaded / uniqueRecords.length) * 100));
        setProgressText(`تم رفع ${uploaded} من ${uniqueRecords.length} سجل...`);
      }

      setResult({
        status: "success",
        message: "تم استيراد البيانات بنجاح",
        details: `إجمالي السجلات: ${records.length} | فريدة: ${uniqueRecords.length} | مكررة تم تجاهلها: ${duplicatesCount}`,
      });
    } catch (err) {
      setResult({
        status: "error",
        message: "حصل خطأ غير متوقع أثناء الاستيراد",
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  if (!authorized) {
    return null;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Database className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              استيراد البيانات
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              رفع بيانات الخطوط من Google Sheet إلى قاعدة البيانات
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {/* Import type selector */}
          <label className="block text-sm font-medium text-slate-600 mb-3">
            نوع الاستيراد
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              disabled={loading}
              onClick={() => setImportType("full")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-right transition disabled:opacity-50 ${
                importType === "full"
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  importType === "full" ? "bg-blue-100" : "bg-slate-100"
                }`}
              >
                <FileSpreadsheet
                  className={`w-4.5 h-4.5 ${
                    importType === "full" ? "text-blue-600" : "text-slate-500"
                  }`}
                />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  استيراد كامل
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  رفع كل بيانات الخطوط والعملاء
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => setImportType("national_id")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-right transition disabled:opacity-50 ${
                importType === "national_id"
                  ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  importType === "national_id" ? "bg-blue-100" : "bg-slate-100"
                }`}
              >
                <IdCard
                  className={`w-4.5 h-4.5 ${
                    importType === "national_id"
                      ? "text-blue-600"
                      : "text-slate-500"
                  }`}
                />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  تحديث الرقم القومي
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  تحديث رقم قومي فقط للخطوط الحالية
                </span>
              </span>
            </button>
          </div>

          {/* Action button */}
          <button
            onClick={importData}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3.5 font-medium transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جارٍ الاستيراد...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                استيراد من Google Sheet
              </>
            )}
          </button>

          {/* Progress */}
          {loading && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>{progressText}</span>
                {progressPercent > 0 && <span>{progressPercent}%</span>}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: progressPercent > 0 ? `${progressPercent}%` : "30%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Result panel */}
          {result && !loading && (
            <div
              className={`mt-5 rounded-xl border p-4 flex items-start gap-3 ${
                result.status === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              {result.status === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    result.status === "success"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {result.message}
                </p>
                {result.details && (
                  <p
                    className={`text-xs mt-1 ${
                      result.status === "success"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {result.details}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <div className="flex items-start gap-2 mt-4 text-xs text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            السجلات المكررة (بنفس رقم الخط) بيتم تجاهلها تلقائياً، والسجلات
            الموجودة بنفس الرقم بيتم تحديثها.
          </span>
        </div>
      </div>
    </div>
  );
}