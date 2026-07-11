import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password, full_name, role, job_title, phone, branch, manager_id, avatar_url } = body;

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: dbData, error: dbError } = await admin.from("users").insert({
    auth_id: data.user.id,
    email, full_name, role,
    job_title: job_title || null,
    phone: phone || null,
    branch: branch || null,
    manager_id: manager_id || null,
    avatar_url: avatar_url || null,
    is_active: true,
  }).select("id").single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json({ success: true, id: dbData.id });
}