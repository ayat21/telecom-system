"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { todayStr } from "@/lib/actionsMeta";
import { CalendarClock, Calendar, AlertTriangle, CheckCircle2, Flame } from "lucide-react";

interface WidgetDef {
  key: string;
  label: string;
  filter: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

const WIDGETS: WidgetDef[] = [
  { key: "due_today", label: "اجراءات اليوم", filter: "due_today", icon: CalendarClock, iconBg: "bg-blue-50", iconColor: "text-blue-600", valueColor: "text-blue-600" },
  { key: "upcoming", label: "اجراءات قادمة", filter: "upcoming", icon: Calendar, iconBg: "bg-indigo-50", iconColor: "text-indigo-600", valueColor: "text-indigo-600" },
  { key: "overdue", label: "اجراءات متأخرة", filter: "overdue", icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: "text-red-500" },
  { key: "completed_today", label: "اكتملت اليوم", filter: "completed_today", icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-600", valueColor: "text-green-600" },
  { key: "high_priority", label: "أولوية عالية", filter: "high_priority", icon: Flame, iconBg: "bg-orange-50", iconColor: "text-orange-600", valueColor: "text-orange-600" },
];

export default function ActionWidgets() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const today = todayStr();
      const openStatuses = ["pending", "in_progress"];
      const base = () => supabase.from("actions").select("*", { count: "exact", head: true });

      const [dueToday, upcoming, overdue, completedToday, highPriority] = await Promise.all([
        base().eq("due_date", today).in("status", openStatuses),
        base().gt("due_date", today).in("status", openStatuses),
        base().lt("due_date", today).in("status", openStatuses),
        base().eq("status", "completed").eq("completed_date", today),
        base().in("priority", ["high", "urgent"]).in("status", openStatuses),
      ]);

      if (!mounted) return;
      setCounts({
        due_today: dueToday.count || 0,
        upcoming: upcoming.count || 0,
        overdue: overdue.count || 0,
        completed_today: completedToday.count || 0,
        high_priority: highPriority.count || 0,
      });
      setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  if (!loaded) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {WIDGETS.map((w) => {
        const Icon = w.icon;
        return (
          <Link key={w.key} href={`/actions?filter=${w.filter}`}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition cursor-pointer">
            <div className="flex items-start justify-between">
              <p className="text-sm text-slate-500">{w.label}</p>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${w.iconBg}`}>
                <Icon className={`w-5 h-5 ${w.iconColor}`} />
              </span>
            </div>
            <p className={`text-3xl font-bold mt-3 ${w.valueColor}`}>
              {(counts[w.key] || 0).toLocaleString()}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
