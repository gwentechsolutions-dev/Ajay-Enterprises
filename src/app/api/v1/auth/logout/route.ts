import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const session = await getSession();

  if (session) {
    await logAuditEvent({
      userId: session.id,
      userName: session.name,
      userRole: session.role,
      action: "LOGOUT",
      module: "AUTH",
      entityType: "User",
      entityId: session.id,
      notes: "User logged out from Supabase Auth session",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

  if (isSupabaseConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut error:", err);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
}
