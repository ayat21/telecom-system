"use client";

import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

export default function ImportPage() {

  async function importData() {

    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3RIh_S4qeeyhhL084Z3Sp5mkhbArHcq1xwIAd7w6cdIVlsph9OmRWU9nebLMc6l48FXH0JQxJ42ba/pub?output=csv";

    const response = await fetch(url);
    const csv = await response.text();

    const result = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = result.data as any[];

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

  total_price: Number(row["اجمالى السعر"] || 0),
}));
alert(records.length);
    console.log(records);

    const uniqueRecords = Array.from(
  new Map(
    records.map((item) => [item.number, item])
  ).values()
);
alert(`
Original: ${records.length}
Unique: ${uniqueRecords.length}
Missing: ${records.length - uniqueRecords.length}
`);
console.log(
  `Original: ${records.length}`,
  `Unique: ${uniqueRecords.length}`
);



  for (let i = 0; i < uniqueRecords.length; i += 500) {
  const batch = uniqueRecords.slice(i, i + 500);

  const { error } = await supabase
    .from("lines")
    .upsert(batch, {
      onConflict: "number",
    });

if (error) {
  console.error(error);

  alert(`
خطأ عند الدفعة:
${i}

${error.message}
  `);

  return;
}

  console.log(
    `تم رفع ${Math.min(i + 500, uniqueRecords.length)} من ${uniqueRecords.length}`
  );
}

alert(
  `تم استيراد ${uniqueRecords.length} سجل بنجاح`
);

alert("تم الاستيراد بنجاح");

   

    alert(
      `تم استيراد ${records.length} سجل بنجاح`
    );
  }

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-6">
        استيراد البيانات
      </h1>

      <button
        onClick={importData}
        className="bg-green-600 text-white px-6 py-3 rounded-lg"
      >
        استيراد من Google Sheet
      </button>

    </div>
  );
}