import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();

  const { auth_id, password } = body;

  const { error } = await admin.auth.admin.updateUserById(auth_id, {
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}