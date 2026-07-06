import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


console.log("KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);



const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password, full_name, role, department_id, job_title } = body;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: dbError } = await admin.from("users").insert({
    auth_id: data.user.id,
    email,
    full_name,
    role,
    department_id: department_id || null,
    job_title: job_title || null,
    is_active: true,
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}