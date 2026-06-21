"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import { useRouter } from "next/navigation";
import router from "next/router";

export default function UsersPage() {

  const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
  
    useEffect(() => {
      const role = localStorage.getItem("role");
  
      if (!role) {
        router.replace("/login");
        return;
      }
  
      setAuthorized(true);
    }, []);
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
const [email, setEmail] = useState("");
const [role, setRole] = useState("viewer");
const [password, setPassword] =
  useState("");

  async function loadUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setUsers(data || []);
    }

    setLoading(false);
  }

  async function addUser() {
  if (!fullName || !email) {
    alert("ادخلي الاسم والإيميل");
    return;
  }


   const { error } = await supabase
  .from("users")
  .insert({
    full_name: fullName,
    email,
    password,
    role,
    is_active: true,
  });

  if (error) {
    alert(error.message);
    return;
  }

  setFullName("");
  setEmail("");
  setRole("viewer");

  loadUsers();
}
  async function toggleUser(id: number, status: boolean) {
    await supabase
      .from("users")
      .update({
        is_active: !status,
      })
      .eq("id", id);

    loadUsers();
  }

  async function changeRole(id: number, role: string) {
    await supabase
      .from("users")
      .update({
        role,
      })
      .eq("id", id);

    loadUsers();
  }

  useEffect(() => {
    loadUsers();
  }, []);



if (!authorized) {
  return null;
}

  return (
    <div className="p-8 text-black" dir="rtl">
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-800">إدارة المستخدمين</h1>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow mb-6">

  <div className="grid md:grid-cols-4 gap-3">

    <input
      value={fullName}
      onChange={(e) =>
        setFullName(e.target.value)
      }
      placeholder="الاسم"
      className="border rounded-lg p-3"
    />

    <input
      value={email}
      onChange={(e) =>
        setEmail(e.target.value)
      }
      placeholder="الإيميل"
      className="border rounded-lg p-3"
    />
    <input
  type="password"
  value={password}
  onChange={(e) =>
    setPassword(e.target.value)
  }
  placeholder="كلمة المرور"
  className="border rounded-lg p-3"
/>

    <select
      value={role}
      onChange={(e) =>
        setRole(e.target.value)
      }
      className="border rounded-lg p-3"
    >
      <option value="viewer">
        Viewer
      </option>

      <option value="admin">
        Admin
      </option>

      <option value="super_admin">
        Super Admin
      </option>
    </select>

    <button
      onClick={addUser}
      className="bg-blue-600 text-white rounded-lg p-3"
    >
      إضافة مستخدم
    </button>

  </div>

</div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        {loading ? (
          <div className="p-6">جاري التحميل...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-4 text-right">الاسم</th>

                <th className="p-4 text-right">الإيميل</th>
                <th className="p-4 text-right">كلمه السر</th>

                <th className="p-4 text-right">الصلاحية</th>

                <th className="p-4 text-right">الحالة</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="p-4">{user.full_name}</td>

                  <td className="p-4">{user.email}</td>
                   <td className="p-4">{user.password}</td>

                  <td className="p-4">
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                      className="border rounded-lg p-2 text-black"
                    >
                      <option value="super_admin">Super Admin</option>

                      <option value="admin">Admin</option>

                      <option value="user">User</option>
                    </select>
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => toggleUser(user.id, user.is_active)}
                      className={`px-4 py-2 rounded-lg text-white ${
                        user.is_active ? "bg-green-600" : "bg-red-600"
                      }`}
                    >
                      {user.is_active ? "فعال" : "موقوف"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
