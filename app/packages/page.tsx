"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PackagesPage() {
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
  const [packages, setPackages] = useState<any[]>([]);
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPackages() {
    setLoading(true);

    const { data: calls } = await supabase.from("calls_packages").select("*");

    const { data: internet } = await supabase
      .from("internet_packages")
      .select("*");

    const { data: extensions } = await supabase
      .from("line_extensions")
      .select("*");

    const allPackages = [
      ...(calls || []).map((item) => ({
        id: item.id,
        provider_name: item.provider_name,
        name: item.package_name,
        price: item.price,
        type: "مكالمات",
      })),

      ...(internet || []).map((item) => ({
        id: item.id,
        provider_name: item.provider_name,
        name: item.package_name,
        price: item.price,
        type: "نت",
      })),

      ...(extensions || []).map((item) => ({
        id: item.id,
        provider_name: item.provider_name,
        name: item.extension_name,
        price: item.price,
        type: "خدمة",
      })),
    ];
    console.log("calls", calls);
    console.log("internet", internet);
    console.log("extensions", extensions);

    console.log("allPackages", allPackages);
    setPackages(allPackages);
    setLoading(false);
  }

  useEffect(() => {
    loadPackages();
  }, []);

  const filteredPackages = packages.filter((item) => {
    const providerMatch = provider === "" || item.provider_name === provider;

    const typeMatch = type === "" || item.type === type;

    return providerMatch && typeMatch;
  });
if (!authorized) {
    return null;
  }
  return (
    <div className="min-h-screen bg-slate-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800">
            إدارة الباقات والخدمات
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="border text-slate-900 rounded-xl p-3"
            >
              <option value="">كل الشبكات</option>

              <option value="vodafone">vodafone</option>

              <option value="etisalat">etisalat</option>

              <option value="orange">orange</option>
            </select>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border text-slate-900 rounded-xl p-3"
            >
              <option value="">كل الأنواع</option>

              <option value="مكالمات">باقات المكالمات</option>

              <option value="نت">باقات الإنترنت</option>

              <option value="خدمة">الخدمات</option>
            </select>
          </div>
        </div>

        <div className=" rounded-2xl shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">جاري التحميل...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-500">
                <tr>
                  <th className="p-4 text-right">الشبكة</th>

                  <th className="p-4 text-right">النوع</th>

                  <th className="p-4 text-right">اسم الباقة</th>

                  <th className="p-4 text-right">السعر</th>
                </tr>
              </thead>

              <tbody className="text-slate-700 text-slate-900 text-[15px]">
                {filteredPackages.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td className="p-4">{item.provider_name}</td>

                    <td className="p-4">{item.type}</td>

                    <td className="p-4">{item.name}</td>

                    <td className="p-4">{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
