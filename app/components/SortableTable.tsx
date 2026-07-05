"use client";
import React, { useMemo, useState } from "react";

type Column<T = any> = {
  key?: string;
  label: React.ReactNode;
  className?: string;
  thClass?: string;
  render?: (row: T) => React.ReactNode;
};

export default function SortableTable<T extends Record<string, any>>(props: {
  columns: Column<T>[];
  data: T[];
  idKey?: string;
  className?: string;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}) {
  const { columns, data, idKey = "id", className = "w-full text-sm", actions, emptyMessage = "لا توجد سجلات" } = props;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);

  function inferType(v: any) {
    if (v == null) return "string";
    if (typeof v === "number") return "number";
    const s = String(v).trim();
    if (!s) return "string";
    const n = Number(s.replace(/[,\s]/g, ""));
    if (!Number.isNaN(n) && /[0-9]/.test(s)) return "number";
    const d = Date.parse(s);
    if (!Number.isNaN(d) && s.length > 3 && /[a-zA-Z/:]/i.test(s)) return "date";
    return "string";
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const type = inferType(va);
      if (type === "number") {
        const na = Number(String(va).replace(/[,\s]/g, "")) || 0;
        const nb = Number(String(vb).replace(/[,\s]/g, "")) || 0;
        return asc ? na - nb : nb - na;
      }
      if (type === "date") {
        const da = Date.parse(String(va)) || 0;
        const db = Date.parse(String(vb)) || 0;
        return asc ? da - db : db - da;
      }
      const sa = String(va || "");
      const sb = String(vb || "");
      return asc ? sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" }) : sb.localeCompare(sa, undefined, { numeric: true, sensitivity: "base" });
    });
    return copy;
  }, [data, sortKey, asc]);

  function onHeaderClick(col: Column<T>) {
    if (!col.key) return;
    if (sortKey === col.key) setAsc((v) => !v);
    else {
      // choose default direction: numbers/dates -> desc first, strings -> asc
      const sample = data.find((d) => typeof d[col.key as string] !== "undefined");
      const t = sample ? inferType(sample[col.key as string]) : "string";
      setSortKey(col.key as string);
      setAsc(!(t === "number" || t === "date"));
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
      <table className={className}>
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`p-3 text-right font-medium ${col.thClass || ""}`} onClick={() => onHeaderClick(col)}>
                <span className="flex items-center justify-end gap-2">
                  <span>{col.label}</span>
                  {col.key && sortKey === col.key && (
                    <span className="text-xs">{asc ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
            ))}
            {actions && <th className="p-3 text-center font-medium">إجراءات</th>}
          </tr>
        </thead>
        <tbody className="text-slate-700">
          {sorted.map((row) => (
            <tr key={row[idKey] ?? JSON.stringify(row)} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
              {columns.map((col, i) => (
                <td key={i} className={`p-3 ${col.className || ""}`}>
                  {col.render ? col.render(row) : (col.key ? String(row[col.key]) : null) || "—"}
                </td>
              ))}
              {actions && <td className="p-3"><div className="flex gap-2 justify-center">{actions(row)}</div></td>}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={(columns.length || 1) + (actions ? 1 : 0)} className="p-10 text-center text-slate-400">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
