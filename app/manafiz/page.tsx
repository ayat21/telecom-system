"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Building2,
  ListTree,
  Network,
  Briefcase,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  Edit2,
  Check,
  X,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Department { id: number; name: string; }
interface Group { id: number; name: string; department_id: number; department_name?: string; }
interface Manfaz { id: number; name: string; group_id: number; group_name?: string; department_name?: string; }
interface Heia { id: number; name: string;group_id: number; group_name?: string; department_name?: string; }

type TabId = "departments" | "groups" | "almanafiz" | "heiaat";

// ============================================================
// Tab config
// ============================================================

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "departments", label: "الأقسام", icon: Building2 },
  { id: "groups",      label: "الجروبات", icon: ListTree },
  { id: "almanafiz",   label: "المنافذ",  icon: Network },
  { id: "heiaat",      label: "الهيئات",  icon: Briefcase },
];

// ============================================================
// Reusable small components
// ============================================================

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </span>
      <h2 className="text-base font-bold text-slate-700">{title}</h2>
    </div>
  );
}

const inputClass =
  "flex-1 border border-slate-200 bg-slate-50 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm";

const selectClass =
  "border border-slate-200 bg-slate-50 text-slate-900 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm";

// ============================================================
// Main Page
// ============================================================

export default function DepartmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("departments");
  const [saving, setSaving] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTable, setEditingTable] = useState("");

  // Data
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [groups, setGroups]             = useState<Group[]>([]);
  const [almanafiz, setAlmanafiz]       = useState<Manfaz[]>([]);
  const [heiaat, setHeiaat]             = useState<Heia[]>([]);

  // Form values
  const [deptName, setDeptName]         = useState("");
  const [groupName, setGroupName]       = useState("");
  const [groupDeptId, setGroupDeptId]   = useState("");
  const [manfazName, setManfazName]     = useState("");
  const [manfazGroupId, setManfazGroupId] = useState("");
  const [heiaGroupId, setheiaGroupId] = useState("");
  const [heiaName, setHeiaName]         = useState("");

  // Auth check
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin" && role !== "super_admin") {
      router.replace("/lines");
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [
  { data: d, error: dError },
  { data: g, error: gError },
  { data: a, error: aError },
  { data: h, error: hError },
] = await Promise.all([
  supabase.from("departments").select("*").order("name"),
  supabase.from("groups").select("*, departments(name)").order("name"),
  supabase.from("almanafiz").select("*, groups(name, departments(name))").order("name"),
  supabase.from("heiaat").select("*, groups(name, departments(name))").order("name")
]);

console.log("DEPARTMENTS", d);
console.log("DEPARTMENTS ERROR", dError);

console.log("GROUPS ERROR", gError);
console.log("ALMANAFIZ ERROR", aError);
console.log("HEIAAT ERROR", hError);

    setDepartments(d || []);
    setGroups(
      (g || []).map((x: any) => ({
        ...x,
        department_name: x.departments?.name || "",
      }))
    );
    setAlmanafiz(
      (a || []).map((x: any) => ({
        ...x,
        group_name:      x.groups?.name || "",
        department_name: x.groups?.departments?.name || "",
      }))
    );
    setHeiaat (
   (h || []).map((x: any) => ({
        ...x,
        group_name:      x.groups?.name || "",
        department_name: x.groups?.departments?.name || "",
      }))
    );
  }

  // --------------------------------------------------------
  // Add handlers
  // --------------------------------------------------------

 async function addDepartment() {
  if (!deptName.trim()) return;

  setSaving(true);

  const { error } = await supabase
    .from("departments")
    .insert({
      name: deptName.trim(),
    });

  console.log("DEPT ERROR", error);

  if (error) {
    alert(error.message);
    setSaving(false);
    return;
  }

  setDeptName("");
  await loadAll();
  setSaving(false);
}

  async function addGroup() {
    if (!groupName.trim() || !groupDeptId) return;
    setSaving(true);
    await supabase.from("groups").insert({
      name: groupName.trim(),
      department_id: Number(groupDeptId),
    });
    setGroupName("");
    setGroupDeptId("");
    await loadAll();
    setSaving(false);
  }

  async function addManfaz() {
    if (!manfazName.trim() || !manfazGroupId) return;
    setSaving(true);
    await supabase.from("almanafiz").insert({
      name: manfazName.trim(),
      group_id: Number(manfazGroupId),
    });
    setManfazName("");
    setManfazGroupId("");
    await loadAll();
    setSaving(false);
  }
  async function addHeia() {
    if (!heiaName.trim() || !heiaGroupId) return;
    setSaving(true);
    await supabase.from("heiaat").insert({
       name: heiaName.trim(),
       group_id: Number(heiaGroupId),
     });
    setHeiaName("");
    setheiaGroupId("");
    await loadAll();
    setSaving(false);
  }

  // --------------------------------------------------------
  // Delete handlers
  // --------------------------------------------------------

  async function deleteItem(table: string, id: number) {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await supabase.from(table).delete().eq("id", id);
    await loadAll();
  }

  // --------------------------------------------------------
  // Edit handlers
  // --------------------------------------------------------

  function startEditing(table: string, id: number, currentName: string) {
    setEditingTable(table);
    setEditingId(id);
    setEditingName(currentName);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingName("");
    setEditingTable("");
  }

  async function saveEditing() {
    if (!editingName.trim() || !editingId || !editingTable) return;
    
    setSaving(true);
    await supabase
      .from(editingTable)
      .update({ name: editingName.trim() })
      .eq("id", editingId);
    
    cancelEditing();
    await loadAll();
    setSaving(false);
  }

  // --------------------------------------------------------
  // Render tab content
  // --------------------------------------------------------

  function renderDepartments() {
    return (
      <>
        <SectionHeader title="الأقسام" icon={Building2} />

        {/* Add form */}
        <div className="flex gap-2 mb-5">
          <input
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDepartment()}
            placeholder="اسم القسم الجديد"
            className={inputClass}
          />
          <button
            onClick={addDepartment}
            disabled={saving || !deptName.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {departments.map((item) => (
            <div key={item.id}>
              {editingId === item.id && editingTable === "departments" ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    className="flex-1 border border-blue-300 bg-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={saveEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition text-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {item.name.charAt(0)}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{item.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEditing("departments", item.id, item.name)}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button
                      onClick={() => deleteItem("departments", item.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا يوجد أقسام</p>
          )}
        </div>
      </>
    );
  }

  function renderGroups() {
    return (
      <>
        <SectionHeader title="الجروبات" icon={ListTree} />

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-5">
          <select
            value={groupDeptId}
            onChange={(e) => setGroupDeptId(e.target.value)}
            className={selectClass}
          >
            <option value="">اختر القسم</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
            placeholder="اسم الجروب الجديد"
            className={inputClass}
          />
          <button
            onClick={addGroup}
            disabled={saving || !groupName.trim() || !groupDeptId}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {groups.map((item) => (
            <div key={item.id}>
              {editingId === item.id && editingTable === "groups" ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    className="flex-1 border border-blue-300 bg-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={saveEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition text-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                      {item.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">{item.department_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEditing("groups", item.id, item.name)}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button
                      onClick={() => deleteItem("groups", item.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا يوجد جروبات</p>
          )}
        </div>
      </>
    );
  }

  function renderAlmanafiz() {
    return (
      <>
        <SectionHeader title="المنافذ" icon={Network} />

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-5">
          <select
            value={manfazGroupId}
            onChange={(e) => setManfazGroupId(e.target.value)}
            className={selectClass}
          >
            <option value="">اختر الجروب</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.department_name}
              </option>
            ))}
          </select>
          <input
            value={manfazName}
            onChange={(e) => setManfazName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManfaz()}
            placeholder="اسم المنفذ الجديد"
            className={inputClass}
          />
          <button
            onClick={addManfaz}
            disabled={saving || !manfazName.trim() || !manfazGroupId}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {almanafiz.map((item) => (
            <div
              key={item.id}
            >
              {editingId === item.id && editingTable === "almanafiz" ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    className="flex-1 border border-blue-300 bg-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={saveEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition text-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600 shrink-0">
                      {item.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.group_name}
                        {item.department_name && ` — ${item.department_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEditing("almanafiz", item.id, item.name)}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button
                      onClick={() => deleteItem("almanafiz", item.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {almanafiz.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا يوجد منافذ</p>
          )}
        </div>
      </>
    );
  }

  function renderHeiaat() {
    return (
      <>
        <SectionHeader title="الهيئات" icon={Briefcase} />

          {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-5">
          <select
            value={heiaGroupId}
            onChange={(e) => setheiaGroupId(e.target.value)}
            className={selectClass}
          >
            <option value="">اختر الجروب</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.department_name}
              </option>
            ))}
          </select>
          <input
            value={heiaName}
            onChange={(e) => setHeiaName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHeia()}
            placeholder="اسم المنفذ الجديد"
            className={inputClass}
          />
          <button
            onClick={addHeia}
            disabled={saving || !heiaName.trim() || !heiaGroupId}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {heiaat.map((item) => (
            <div
              key={item.id}
            >
              {editingId === item.id && editingTable === "heiaat" ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing();
                      if (e.key === "Escape") cancelEditing();
                    }}
                    className="flex-1 border border-blue-300 bg-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                  />
                  <button
                    onClick={saveEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition text-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600 shrink-0">
                      {item.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.group_name}
                        {item.department_name && ` — ${item.department_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEditing("heiaat", item.id, item.name)}
                      className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button
                      onClick={() => deleteItem("heiaat", item.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {heiaat.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا يوجد هيئات</p>
          )}
        </div>
      </>
    );
  }

 const tabContent: Record<TabId, () => React.ReactNode> = {
    departments: renderDepartments,
    groups:      renderGroups,
    almanafiz:   renderAlmanafiz,
    heiaat:      renderHeiaat,
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-l from-blue-600 to-blue-500 rounded-2xl px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                إدارة الهيكل التنظيمي
              </h1>
              <p className="text-sm text-blue-100 mt-0.5">
                الأقسام • الجروبات • المنافذ • الهيئات
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition text-white px-4 py-2.5 rounded-xl font-medium text-sm border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
            رجوع
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 mb-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {tabContent[activeTab]()}
        </div>
      </div>
    </div>
  );
}