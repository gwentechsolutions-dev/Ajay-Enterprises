import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/audit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Password reset validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const { newPassword } = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    if (isSupabaseConfigured) {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RESET_FAILED",
              message: error.message || "Failed to reset password. Link may have expired.",
            },
          },
          { status: 400 }
        );
      }

      if (data?.user) {
        await logAuditEvent({
          userId: data.user.id,
          userName: data.user.email,
          action: "PASSWORD_CHANGE",
          module: "AUTH",
          entityType: "User",
          entityId: data.user.id,
          notes: "Password reset successfully completed via Supabase Auth recovery",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Password has been successfully updated. You may now log in.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
