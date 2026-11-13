import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/audit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Invalid email address" } },
        { status: 422 }
      );
    }

    const { email } = parsed.data;
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    if (user && isSupabaseConfigured) {
      const supabase = await createServerSupabaseClient();
      const origin = req.nextUrl.origin || process.env.APP_URL || "http://localhost:3000";
      await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${origin}/reset-password`,
      });

      await logAuditEvent({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "UPDATE",
        module: "AUTH",
        entityType: "User",
        entityId: user.id,
        notes: "Password reset requested via Supabase Auth email",
      });
    }

    // Always respond with success to prevent user email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, password reset instructions have been dispatched.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
