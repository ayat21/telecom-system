"use client";
import { useEffect } from "react";

export default function SortableTablesClient() {
  useEffect(() => {
    const tables = Array.from(document.querySelectorAll("table")) as HTMLTableElement[];
    const colState = new WeakMap<HTMLTableElement, { idx: number; asc: boolean; type?: string }>();

    function createIndicator(th: HTMLTableCellElement) {
      let span = th.querySelector<HTMLSpanElement>(".sort-indicator");
      if (!span) {
        span = document.createElement("span");
        span.className = "sort-indicator ml-2 text-xs text-slate-400";
        th.appendChild(span);
      }
      return span;
    }

    function updateIndicators(table: HTMLTableElement) {
      const state = colState.get(table);
      const ths = Array.from(table.tHead?.querySelectorAll("th") || []);
      ths.forEach((th, i) => {
        const span = th.querySelector<HTMLSpanElement>(".sort-indicator");
        if (!span) return;
        if (state && state.idx === i) {
          span.textContent = state.asc ? " ▲" : " ▼";
        } else {
          span.textContent = "";
        }
      });
    }

    function getCellText(cell: Element | null) {
      if (!cell) return "";
      return (cell.textContent || "").trim();
    }

    function compareValues(a: string, b: string) {
      const aNum = parseFloat(a.replace(/[,\s]/g, ""));
      const bNum = parseFloat(b.replace(/[,\s]/g, ""));
      const aIsNum = !Number.isNaN(aNum) && a.trim() !== "";
      const bIsNum = !Number.isNaN(bNum) && b.trim() !== "";
      if (aIsNum && bIsNum) return aNum - bNum;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }

    function sortTable(table: HTMLTableElement, colIndex: number, asc: boolean) {
      const tbody = table.tBodies[0];
      if (!tbody) return;
      const rows = Array.from(tbody.rows);
      rows.sort((r1, r2) => {
        const v1 = getCellText(r1.cells[colIndex]);
        const v2 = getCellText(r2.cells[colIndex]);
        const cmp = compareValues(v1, v2);
        return asc ? cmp : -cmp;
      });
      // re-append
      for (const r of rows) tbody.appendChild(r);
    }

    function inferColumnType(table: HTMLTableElement, colIndex: number) {
      const tbody = table.tBodies[0];
      if (!tbody) return "string";
      const rows = Array.from(tbody.rows).slice(0, 12);
      let num = 0, date = 0, total = 0;
      for (const r of rows) {
        const v = getCellText(r.cells[colIndex]);
        if (!v) continue;
        total++;
        const n = Number(v.replace(/[,\s]/g, ""));
        if (!Number.isNaN(n) && v.match(/[0-9]/)) num++;
        const parsed = Date.parse(v);
        if (!Number.isNaN(parsed) && v.length > 3 && !/^[0-9]+$/.test(v)) date++;
      }
      if (total === 0) return "string";
      if (num / total >= 0.6) return "number";
      if (date / total >= 0.6) return "date";
      return "string";
    }

    function initializeTable(table: HTMLTableElement) {
      if (table.dataset.sortable === "true") return; // already initialized
      const thead = table.tHead;
      if (!thead) return;
      Array.from(thead.querySelectorAll("th")).forEach((th, idx) => {
        th.style.cursor = "pointer";
        th.tabIndex = 0;
        createIndicator(th as HTMLTableCellElement);
        const onActivate = (ev: Event) => {
          ev.preventDefault();
          const prev = colState.get(table) ?? { idx: -1, asc: true };
          let asc: boolean;
          let type = prev.type;
          if (prev.idx === idx && typeof prev.type !== "undefined") {
            // same column: toggle
            asc = !prev.asc;
            type = prev.type;
          } else {
            // new column: infer type and choose default direction
            type = inferColumnType(table, idx);
            asc = type === "number" || type === "date" ? false : true; // numbers/dates -> desc first
          }
          colState.set(table, { idx, asc, type });
          sortTable(table, idx, asc);
          updateIndicators(table);
        };
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") onActivate(e as unknown as Event);
        };
        th.addEventListener("click", onActivate);
        th.addEventListener("keydown", onKey);
      });
      table.dataset.sortable = "true";
    }

    // initialize existing tables
    tables.forEach(initializeTable);

    // watch for dynamically added tables
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          if (!(n instanceof Element)) continue;
          if (n.tagName.toLowerCase() === "table") initializeTable(n as HTMLTableElement);
          else {
            const found = Array.from(n.querySelectorAll("table"));
            found.forEach((t) => initializeTable(t as HTMLTableElement));
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      // cleanup: remove dataset so next mount can re-init
      tables.forEach((t) => delete t.dataset.sortable);
      observer.disconnect();
    };
  }, []);

  return null;
}
