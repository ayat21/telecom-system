"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Users, PlusCircle, Loader2, Pencil, X, Check,
  Briefcase, Mail, User as UserIcon, Lock,
  Phone, MapPin, ImagePlus, List, Network, LayoutGrid, ChevronDown,
} from "lucide-react";

const EMPTY_FORM = {
  fullName: "", email: "", password: "", role: "viewer",
  teamIds: [] as number[], jobTitle: "", phone: "", branch: "", managerId: "",
};

function Avatar({ url, name, size = "w-9 h-9" }: { url?: string | null; name: string; size?: string }) {
  if (url) {
    return <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0 border border-slate-200`} />;
  }
  return (
    <span className={`${size} rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0`}>
      {name?.charAt(0) || "?"}
    </span>
  );
}

// ─── Multi-select للتيمات ─────────────────────────────────────
function TeamsMultiSelect({ teamsList, selected, onChange }: {
  teamsList: any[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const selectedNames = teamsList.filter((t) => selected.includes(t.id)).map((t) => t.name);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 relative">
        <LayoutGrid className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <span className={`truncate pr-6 ${selectedNames.length ? "text-slate-700" : "text-slate-400"}`}>
          {selectedNames.length ? selectedNames.join("، ") : "اختر التيم/التيمات"}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {teamsList.map((t) => (
            <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(t.id)}
                onChange={() => toggle(t.id)}
                className="rounded border-slate-300 text-blue-500" />
              <span className="text-sm text-slate-700">{t.name}</span>
            </label>
          ))}
          {teamsList.length === 0 && (
            <p className="px-4 py-3 text-xs text-slate-400 text-center">لا توجد تيمات</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── كارت الموظف ────────────────────────────────────────────
function PersonCard({ user, onEdit, colorClass }: { user: any; onEdit: (u: any) => void; colorClass: string }) {
  const teamNames = (user.teamsList || []).map((t: any) => t.name).join("، ");
  return (
    <div dir="rtl"
      className={`bg-white rounded-xl border-2 ${colorClass} shadow-sm p-3 w-[170px] text-center relative group shrink-0`}>
      <button onClick={() => onEdit(user)}
        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 bg-slate-50 hover:bg-slate-100 text-slate-500 w-6 h-6 flex items-center justify-center rounded-md transition">
        <Pencil className="w-3 h-3" />
      </button>
      <Avatar url={user.avatar_url} name={user.full_name} size="w-10 h-10" />
      <p className="text-sm font-bold text-slate-800 mt-2 truncate">{user.full_name}</p>
      <p className="text-xs text-blue-600 font-medium truncate">{user.job_title || "—"}</p>
      {teamNames && (
        <p className="text-[11px] text-emerald-600 font-medium truncate mt-0.5">{teamNames}</p>
      )}
      {user.branch && (
        <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center justify-center gap-1">
          <MapPin className="w-2.5 h-2.5" /> {user.branch}
        </p>
      )}
      {!user.is_active && (
        <span className="inline-block mt-1 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">موقوف</span>
      )}
    </div>
  );
}

// ─── كارت التيم ────────────────────────────────────────────
function TeamBox({ name }: { name: string }) {
  return (
    <div className="bg-emerald-50 rounded-xl border-2 border-emerald-300 shadow-sm px-4 py-2.5 text-center shrink-0">
      <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">{name}</p>
    </div>
  );
}

// ─── خط عمودي بسيط بين مستويين ────────────────────────────────
function VLine() {
  return <div className="w-px bg-slate-300 shrink-0" style={{ height: 20 }} />;
}

// ─── صف أبناء بخط أفقي واحد فوقهم متصل بخط عمودي للأب ────────
function ChildrenRow({ children: nodes }: { children: React.ReactNode }) {
  const items = Array.isArray(nodes) ? nodes.filter(Boolean) : [nodes].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col items-center">
      <VLine />
      {items.length > 1 ? (
        <div className="relative flex items-start gap-8">
          {/* الخط الأفقي اللي بيوصل كل الأبناء ببعض */}
          <div className="absolute top-0 right-0 left-0 h-px bg-slate-300" style={{ marginTop: -1 }} />
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center pt-5 relative">
              <div className="absolute top-0 w-px bg-slate-300" style={{ height: 20 }} />
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div>{items}</div>
      )}
    </div>
  );
}

// ─── الشجرة: تيمات نفس المدير جنب بعض أفقياً بمسافات موحدة ───
function OrgTreeNode({ user, allUsers, onEdit }: {
  user: any; allUsers: any[]; onEdit: (u: any) => void;
}) {
  const children = allUsers.filter((u) => u.manager_id === user.id);
  const hasChildren = children.length > 0;
  const colorClass = hasChildren ? "border-sky-300" : "border-amber-300";

  if (!hasChildren) {
    return <PersonCard user={user} onEdit={onEdit} colorClass={colorClass} />;
  }

  const managerTeams: { id: number; name: string }[] = user.teamsList || [];

  // ─── المدير مسؤول عن أكتر من تيم → أعمدة التيمات جنب بعض أفقياً ───
  if (managerTeams.length > 1) {
    const groups = managerTeams
      .map((team) => ({
        team,
        members: children.filter((c) => (c.teamsList || []).some((t: any) => t.id === team.id)),
      }))
      .filter((g) => g.members.length > 0);

    const matchedIds = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
    const others = children.filter((c) => !matchedIds.has(c.id));
    if (others.length > 0) groups.push({ team: { id: -1, name: "أخرى" }, members: others });

    return (
      <div className="flex flex-col items-center">
        <PersonCard user={user} onEdit={onEdit} colorClass={colorClass} />
        <ChildrenRow>
          {groups.map((g) => (
            <div key={g.team.id} className="flex flex-col items-center">
              <TeamBox name={g.team.name} />
              <ChildrenRow>
                {g.members.map((child) => (
                  <OrgTreeNode key={child.id} user={child} allUsers={allUsers} onEdit={onEdit} />
                ))}
              </ChildrenRow>
            </div>
          ))}
        </ChildrenRow>
      </div>
    );
  }

  // ─── تيم واحد أو من غير تيم → أعضاء الفريق جنب بعض مباشرة ───
  return (
    <div className="flex flex-col items-center">
      <PersonCard user={user} onEdit={onEdit} colorClass={colorClass} />
      <ChildrenRow>
        {children.map((child) => (
          <OrgTreeNode key={child.id} user={child} allUsers={allUsers} onEdit={onEdit} />
        ))}
      </ChildrenRow>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "hierarchy">("table");

  const [form, setForm] = useState(EMPTY_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Modal تعديل
  const [editModal, setEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    jobTitle: "", teamIds: [] as number[], phone: "", branch: "", managerId: "",
  });
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  // ─── تحميل المستخدمين + تيماتهم ────────────────────────────
  async function loadUsers() {
    setLoading(true);
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: userTeamsData } = await supabase
      .from("user_teams")
      .select("user_id, teams(id, name)");

    const teamsMap = new Map<number, { id: number; name: string }[]>();
    (userTeamsData || []).forEach((row: any) => {
      if (!row.teams) return;
      if (!teamsMap.has(row.user_id)) teamsMap.set(row.user_id, []);
      teamsMap.get(row.user_id)!.push({ id: row.teams.id, name: row.teams.name });
    });

    const merged = (usersData || []).map((u) => ({ ...u, teamsList: teamsMap.get(u.id) || [] }));
    setUsers(merged);
    setLoading(false);
  }

  async function loadTeams() {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    setTeamsList(data || []);
  }

  useEffect(() => {
    loadUsers();
    loadTeams();
  }, []);

  // ─── رفع صورة ─────────────────────────────────────────────
  async function uploadAvatar(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(fileName, file, {
      cacheControl: "3600", upsert: false,
    });
    if (error) { alert(`فشل رفع الصورة: ${error.message}`); return null; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    return data.publicUrl;
  }

  // ─── حفظ ربط التيمات لمستخدم ────────────────────────────────
  async function saveUserTeams(userId: number, teamIds: number[]) {
    await supabase.from("user_teams").delete().eq("user_id", userId);
    if (teamIds.length > 0) {
      await supabase.from("user_teams").insert(teamIds.map((teamId) => ({ user_id: userId, team_id: teamId })));
    }
  }

  // ─── إضافة مستخدم ─────────────────────────────────────────
  async function addUser() {
    if (!form.fullName || !form.email || !form.password) {
      alert("ادخلي الاسم والإيميل وكلمة المرور");
      return;
    }
    setSaving(true);

    let avatarUrl: string | null = null;
    if (avatarFile) {
      setUploadingAvatar(true);
      avatarUrl = await uploadAvatar(avatarFile);
      setUploadingAvatar(false);
    }

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        job_title: form.jobTitle || null,
        phone: form.phone || null,
        branch: form.branch || null,
        manager_id: form.managerId ? Number(form.managerId) : null,
        avatar_url: avatarUrl,
      }),
    });

    const result = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(result.error);
      return;
    }

    if (result.id && form.teamIds.length > 0) {
      await saveUserTeams(result.id, form.teamIds);
    }

    setForm(EMPTY_FORM);
    setAvatarFile(null);
    if (addFileInputRef.current) addFileInputRef.current.value = "";
    loadUsers();
  }

  // ─── تعديل حالة ───────────────────────────────────────────
  async function toggleUser(id: number, status: boolean) {
    await supabase.from("users").update({ is_active: !status }).eq("id", id);
    loadUsers();
  }

  // ─── تعديل الصلاحية ───────────────────────────────────────
  async function changeRole(id: number, role: string) {
    await supabase.from("users").update({ role }).eq("id", id);
    loadUsers();
  }

  // ─── فتح مودال تعديل ──────────────────────────────────────
  function openEdit(user: any) {
    setEditingUser(user);
    setEditForm({
      jobTitle: user.job_title || "",
      teamIds: (user.teamsList || []).map((t: any) => t.id),
      phone: user.phone || "",
      branch: user.branch || "",
      managerId: String(user.manager_id || ""),
    });
    setEditAvatarFile(null);
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editingUser) return;
    setSaving(true);

    let avatarUrl: string | undefined = undefined;
    if (editAvatarFile) {
      setUploadingAvatar(true);
      const uploaded = await uploadAvatar(editAvatarFile);
      setUploadingAvatar(false);
      if (uploaded) avatarUrl = uploaded;
    }

    const updates: Record<string, any> = {
      job_title: editForm.jobTitle || null,
      phone: editForm.phone || null,
      branch: editForm.branch || null,
      manager_id: editForm.managerId ? Number(editForm.managerId) : null,
    };
    if (avatarUrl) updates.avatar_url = avatarUrl;

    await supabase.from("users").update(updates).eq("id", editingUser.id);
    await saveUserTeams(editingUser.id, editForm.teamIds);

    setSaving(false);
    setEditModal(false);
    loadUsers();
  }

  if (!authorized) return null;

  // ─── جذور الشجرة: المستخدمين اللي معندهمش مدير ────────────
  const rootUsers = users.filter((u) => !u.manager_id || !users.find((m) => m.id === u.manager_id));

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة المستخدمين</h1>
              <p className="text-sm text-slate-500 mt-0.5">{users.length} مستخدم</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === "table" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}>
              <List className="w-4 h-4" /> جدول
            </button>
            <button onClick={() => setViewMode("hierarchy")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === "hierarchy" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"
              }`}>
              <Network className="w-4 h-4" /> الشجرة التنظيمية
            </button>
          </div>
        </div>

        {/* Add User Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">إضافة مستخدم جديد</p>

          <div className="flex flex-wrap gap-4 mb-4">
            {/* Avatar upload */}
            <div className="shrink-0">
              <label className="block text-xs text-slate-500 mb-1.5">الصورة</label>
              <label className="flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 cursor-pointer bg-slate-50 overflow-hidden transition">
                {avatarFile ? (
                  <img src={URL.createObjectURL(avatarFile)} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                )}
                <input ref={addFileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="flex-1 grid md:grid-cols-3 gap-3">
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="الاسم الكامل"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="email" value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="البريد الإلكتروني"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="password" value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="كلمة المرور"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="رقم التليفون"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={form.branch}
                  onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                  placeholder="الفرع"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={form.jobTitle}
                  onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="الوظيفة (خدمة عملاء، تشغيل، تحصيل...)"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <TeamsMultiSelect teamsList={teamsList} selected={form.teamIds}
              onChange={(ids) => setForm((p) => ({ ...p, teamIds: ids }))} />

            <div className="relative">
              <Network className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={form.managerId}
                onChange={(e) => setForm((p) => ({ ...p, managerId: e.target.value }))}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none">
                <option value="">بدون مدير مباشر</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>

            <select value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>

            <button onClick={addUser} disabled={saving || uploadingAvatar}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-sm font-medium transition">
              {saving || uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {uploadingAvatar ? "جارٍ رفع الصورة..." : "إضافة مستخدم"}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium">المستخدم</th>
                  <th className="p-3 text-right font-medium">الإيميل</th>
                  <th className="p-3 text-right font-medium">الموبايل</th>
                  <th className="p-3 text-right font-medium">الوظيفة</th>
                  <th className="p-3 text-right font-medium">الفرع</th>
                  <th className="p-3 text-right font-medium">التيمات</th>
                  <th className="p-3 text-right font-medium">المدير المباشر</th>
                  <th className="p-3 text-right font-medium">الصلاحية</th>
                  <th className="p-3 text-right font-medium">الحالة</th>
                  <th className="p-3 text-center font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {users.map((user) => {
                  const manager = users.find((m) => m.id === user.manager_id);
                  return (
                    <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar url={user.avatar_url} name={user.full_name} />
                          <span className="font-medium text-slate-900">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{user.email}</td>
                      <td className="p-3 text-slate-500" dir="ltr">{user.phone || "—"}</td>
                      <td className="p-3">{user.job_title || "—"}</td>
                      <td className="p-3 text-slate-500">{user.branch || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(user.teamsList || []).length > 0 ? (
                            user.teamsList.map((t: any) => (
                              <span key={t.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                {t.name}
                              </span>
                            ))
                          ) : "—"}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{manager?.full_name || "—"}</td>
                      <td className="p-3">
                        <select value={user.role}
                          onChange={(e) => changeRole(user.id, e.target.value)}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <button onClick={() => toggleUser(user.id, user.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition ${
                            user.is_active ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
                          }`}>
                          {user.is_active ? "فعال" : "موقوف"}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <button onClick={() => openEdit(user)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-slate-400">لا يوجد مستخدمين</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // ─── Org Chart View ─────────────────────────────────
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 overflow-x-auto">
            {rootUsers.length > 0 ? (
              <div className="flex items-start gap-10 justify-center min-w-max mx-auto">
                {rootUsers.map((rootUser) => (
                  <OrgTreeNode key={rootUser.id} user={rootUser} allUsers={users} onEdit={openEdit} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-10">لا يوجد مستخدمين لعرضهم في الشجرة</p>
            )}
          </div>
        )}
      </div>

      {/* Modal تعديل */}
      {editModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                تعديل بيانات {editingUser.full_name}
              </h2>
              <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <label className="flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 cursor-pointer bg-slate-50 overflow-hidden transition shrink-0">
                  {editAvatarFile ? (
                    <img src={URL.createObjectURL(editAvatarFile)} alt="preview" className="w-full h-full object-cover" />
                  ) : editingUser.avatar_url ? (
                    <img src={editingUser.avatar_url} alt="current" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-5 h-5 text-slate-400" />
                  )}
                  <input ref={editFileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => setEditAvatarFile(e.target.files?.[0] || null)} />
                </label>
                <p className="text-xs text-slate-400">اضغطي على الصورة لتغييرها</p>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الوظيفة</label>
                <input value={editForm.jobTitle}
                  onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="الوظيفة (خدمة عملاء، تشغيل، تحصيل...)"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">رقم التليفون</label>
                <input value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="رقم التليفون" dir="ltr"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الفرع</label>
                <input value={editForm.branch}
                  onChange={(e) => setEditForm((p) => ({ ...p, branch: e.target.value }))}
                  placeholder="الفرع"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">التيمات (تقدري تختاري أكتر من واحد)</label>
                <TeamsMultiSelect teamsList={teamsList} selected={editForm.teamIds}
                  onChange={(ids) => setEditForm((p) => ({ ...p, teamIds: ids }))} />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">المدير المباشر</label>
                <select value={editForm.managerId}
                  onChange={(e) => setEditForm((p) => ({ ...p, managerId: e.target.value }))}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">بدون مدير مباشر</option>
                  {users.filter((u) => u.id !== editingUser.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} disabled={saving || uploadingAvatar}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {saving || uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploadingAvatar ? "جارٍ رفع الصورة..." : "حفظ"}
              </button>
              <button onClick={() => setEditModal(false)}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}