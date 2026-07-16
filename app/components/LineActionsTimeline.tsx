"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { typeLabel, priorityMeta, statusMeta, todayStr, ActionRow } from "@/lib/actionsMeta";
import { ClipboardList, Loader2, PlusCircle, AlertTriangle, CheckCircle2, User } from "lucide-react";

export default function LineActionsTimeline({ lineNumber }: { lineNumber: string }) {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lineNumber) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("actions")
        .select("*, users:assigned_user_id(full_name)")
        .eq("line_number", lineNumber)
        .order("due_date", { ascending: false })
        .order("id", { ascending: false });
      if (mounted) {
        setActions((data as ActionRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [lineNumber]);

  const today = todayStr();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الأكشنات...
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
        <ClipboardList className="w-9 h-9 text-slate-200" />
        <p className="text-sm">لا توجد أكشنات لهذا الخط</p>
        <Link href="/actions" className="flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline">
          <PlusCircle className="w-4 h-4" /> إنشاء أكشن جديد
        </Link>
      </div>
    );
  }

  return (
    <div className="relative pr-5">
      {/* خط التايم لاين */}
      <div className="absolute right-[9px] top-2 bottom-2 w-0.5 bg-slate-200 rounded-full" />

      <div className="space-y-4">
        {actions.map((a) => {
          const pm = priorityMeta(a.priority);
          const sm = statusMeta(a.status);
          const isOverdue = a.due_date < today && (a.status === "pending" || a.status === "in_progress");
          const dotColor =
            a.status === "completed" ? "bg-green-500" :
            a.status === "cancelled" ? "bg-slate-300" :
            isOverdue ? "bg-red-500" : "bg-blue-500";

          return (
            <div key={a.id} className="relative">
              <span className={`absolute -right-5 top-4 w-3 h-3 rounded-full ring-4 ring-white ${dotColor}`} />
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/40 mr-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">{a.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.badge}`}>{pm.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sm.badge}`}>{sm.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{typeLabel(a.action_type)}</span>
                    </div>
                    {a.description && <p className="text-xs text-slate-500 mt-1.5">{a.description}</p>}
                  </div>
                  <div className="text-left shrink-0">
                    <p className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? "text-red-600" : "text-slate-500"}`}>
                      {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                      استحقاق: {a.due_date}
                    </p>
                    {a.users?.full_name && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 justify-end">
                        <User className="w-3 h-3" /> {a.users.full_name}
                      </p>
                    )}
                  </div>
                </div>

                {a.status === "completed" && (
                  <div className="flex items-center gap-2 mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    اكتمل في {a.completed_date || "—"}
                    {a.completed_by && ` بواسطة ${a.completed_by}`}
                    {a.completion_notes && ` — ${a.completion_notes}`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
