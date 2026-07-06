"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Users, PlusCircle, Loader2, Pencil, X, Check,
  Building2, Briefcase, Mail, User as UserIcon, Lock,
} from "lucide-react";

const EMPTY_FORM = {
  fullName: "", email: "", password: "", role: "viewer",
  departmentId: "", jobTitle: "",
};

export default function UsersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  // Modal تعديل
  const [editModal, setEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ jobTitle: "", departmentId: "" });

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) { router.replace("/login"); return; }
    setAuthorized(true);
  }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("*, departments(name)")
      .order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function loadDepartments() {
    const { data } = await supabase.from("departments").select("id, name").order("name");
    setDepartments(data || []);
  }

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  // ─── إضافة مستخدم ─────────────────────────────────────────
  async function addUser() {
    if (!form.fullName || !form.email || !form.password) {
      alert("ادخلي الاسم والإيميل وكلمة المرور");
      return;
    }
    setSaving(true);

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        department_id: form.departmentId ? Number(form.departmentId) : null,
        job_title: form.jobTitle || null,
      }),
    });

    const result = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(result.error);
      return;
    }

    setForm(EMPTY_FORM);
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

  // ─── فتح مودال تعديل القسم/الوظيفة ────────────────────────
  function openEdit(user: any) {
    setEditingUser(user);
    setEditForm({
      jobTitle: user.job_title || "",
      departmentId: String(user.department_id || ""),
    });
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editingUser) return;
    setSaving(true);

    await supabase.from("users").update({
      job_title: editForm.jobTitle || null,
      department_id: editForm.departmentId ? Number(editForm.departmentId) : null,
    }).eq("id", editingUser.id);

    setSaving(false);
    setEditModal(false);
    loadUsers();
  }

  if (!authorized) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-blue-600" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">إدارة المستخدمين</h1>
            <p className="text-sm text-slate-500 mt-0.5">{users.length} مستخدم</p>
          </div>
        </div>

        {/* Add User Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">إضافة مستخدم جديد</p>
          <div className="grid md:grid-cols-3 gap-3 mb-3">
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
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={form.jobTitle}
                onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                placeholder="الوظيفة"
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select value={form.departmentId}
                onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none">
                <option value="">اختر القسم</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
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

            <button onClick={addUser} disabled={saving}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-4 py-3 text-sm font-medium transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              إضافة مستخدم
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 py-16 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-right font-medium">الاسم</th>
                  <th className="p-3 text-right font-medium">الإيميل</th>
                  <th className="p-3 text-right font-medium">الوظيفة</th>
                  <th className="p-3 text-right font-medium">القسم</th>
                  <th className="p-3 text-right font-medium">الصلاحية</th>
                  <th className="p-3 text-right font-medium">الحالة</th>
                  <th className="p-3 text-center font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="p-3 font-medium text-slate-900">{user.full_name}</td>
                    <td className="p-3 text-slate-500">{user.email}</td>
                    <td className="p-3">{user.job_title || "—"}</td>
                    <td className="p-3">
                      {user.departments?.name ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {user.departments.name}
                        </span>
                      ) : "—"}
                    </td>
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
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">لا يوجد مستخدمين</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal تعديل القسم/الوظيفة */}
      {editModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                تعديل بيانات {editingUser.full_name}
              </h2>
              <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">الوظيفة</label>
                <input value={editForm.jobTitle}
                  onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="الوظيفة"
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5">القسم</label>
                <select value={editForm.departmentId}
                  onChange={(e) => setEditForm((p) => ({ ...p, departmentId: e.target.value }))}
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">بدون قسم</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-medium text-sm transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حفظ
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