"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
     

      if (error) {
        alert(error.message);
        return;
      }

     const { data: userData, error: userError } = await supabase
  .from("users")
  .select("*")
  .eq("auth_id", data.user.id)
  .single();

 localStorage.setItem(
  "user_id",
  userData.id.toString()
);

localStorage.setItem(
  "full_name",
  userData.full_name
);

localStorage.setItem(
  "role",
  userData.role
);



      if (!userData) {
        alert("المستخدم غير موجود");
        return;
      }

      localStorage.setItem("role", userData.role);
      localStorage.setItem("full_name", userData.full_name);
     
      router.push("/reports/sales");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-100"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-slate-800">
سيستم اتصالات تيليكوم          </h1>

          <p className="text-slate-500 mt-2">
            تسجيل الدخول
          </p>

        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block mb-2 text-slate-700">
              البريد الإلكتروني
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-slate-900"
            />
          </div>

          <div>
            <label className="block mb-2 text-slate-700">
              كلمة المرور
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>

        </form>

      </div>
    </div>
  );
}