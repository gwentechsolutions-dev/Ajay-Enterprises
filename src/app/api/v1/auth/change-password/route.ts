import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/audit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "User account not found" } },
        { status: 404 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    if (isSupabaseConfigured) {
      const supabase = await createServerSupabaseClient();
      // Verify current password by verifying credentials
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password does not match" } },
          { status: 400 }
        );
      }

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return NextResponse.json(
          { success: false, error: { code: "AUTH_PROVIDER_ERROR", message: updateError.message } },
          { status: 400 }
        );
      }
    }

    await logAuditEvent({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "PASSWORD_CHANGE",
      module: "AUTH",
      entityType: "User",
      entityId: user.id,
      notes: "User successfully changed password via Supabase Auth",
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
