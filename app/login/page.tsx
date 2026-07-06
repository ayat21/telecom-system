"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Mail, Lock, Eye, EyeOff, PhoneCall } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

     if (error) {
  console.log(error);
  console.log(error.message);
  console.log(error.status);

  setError(error.message);
  return;
}

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", data.user.id)
        .single();

      if (!userData) {
        setError("المستخدم غير موجود");
        return;
      }

      localStorage.setItem("user_id", userData.id.toString());
      localStorage.setItem("full_name", userData.full_name);
      localStorage.setItem("role", userData.role);

      router.push("/");
      router.refresh();
    } catch (err) {
      setError("حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex bg-slate-50">

      {/* Left side — decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 items-center justify-center p-12 relative overflow-hidden">
        {/* Circles decoration */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full" />

        <div className="relative z-10 text-center text-white max-w-md">
          {/* Icon */}
          <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-8 border border-white/20">
            <PhoneCall className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-4xl font-bold mb-4 leading-tight">
            سيستم اتصالات تيليكوم
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            نظام متكامل لإدارة الخطوط والمبيعات والتحصيل
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-12">
            {[
              { label: "إدارة الخطوط", icon: "📱" },
              { label: "تقارير المبيعات", icon: "📊" },
              { label: "متابعة التحصيل", icon: "💰" },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-xs text-blue-200 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — login form */}
      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
              <PhoneCall className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">سيستم اتصالات تيليكوم</h1>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">مرحباً بك 👋</h2>
              <p className="text-slate-500 mt-1 text-sm">سجّل دخولك للمتابعة</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <span className="shrink-0">⚠️</span>
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-10 pl-10 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 shadow-sm shadow-blue-200 mt-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />جاري تسجيل الدخول...</>
                  : "تسجيل الدخول"}
              </button>

            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            سيستم اتصالات تيليكوم © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}