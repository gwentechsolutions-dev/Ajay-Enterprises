import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/audit";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Check if system requires initial first-run setup
    const userCount = await db.user.count();
    if (userCount === 0) {
      return NextResponse.json(
        {
          success: false,
          needSetup: true,
          error: {
            code: "SETUP_REQUIRED",
            message: "System has no active users. Please complete initial owner setup.",
          },
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid login credentials format",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const { loginIdentifier, password } = parsed.data;

    // Search user by email or username
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier.toLowerCase().trim() },
          { username: loginIdentifier.trim() },
        ],
      },
    });

    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (!user) {
      await logAuditEvent({
        action: "FAILED_LOGIN",
        module: "AUTH",
        entityType: "User",
        ipAddress,
        userAgent,
        notes: `Attempted login for non-existent identifier: ${loginIdentifier}`,
      });

      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password" },
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      await logAuditEvent({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "FAILED_LOGIN",
        module: "AUTH",
        entityType: "User",
        ipAddress,
        userAgent,
        notes: "Attempted login to deactivated account",
      });

      return NextResponse.json(
        {
          success: false,
          error: { code: "ACCOUNT_DEACTIVATED", message: "Your account is inactive. Please contact the administrator." },
        },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    let authUserId = user.supabaseId;

    if (isSupabaseConfigured) {
      const supabase = await createServerSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError || !authData.user) {
        await logAuditEvent({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: "FAILED_LOGIN",
          module: "AUTH",
          entityType: "User",
          ipAddress,
          userAgent,
          notes: `Supabase authentication failed: ${authError?.message || "Invalid credentials"}`,
        });

        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password" },
          },
          { status: 401 }
        );
      }

      authUserId = authData.user.id;
    }

    // Update last login timestamp & link supabaseId if needed
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        supabaseId: authUserId || user.supabaseId,
      },
    });

    const sessionUser = {
      id: user.id,
      supabaseId: authUserId,
      userCode: user.userCode,
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      branchId: user.branchId,
      warehouseId: user.warehouseId,
    };

    await logAuditEvent({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "LOGIN",
      module: "AUTH",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      notes: "User successfully authenticated via Supabase Auth",
    });

    return NextResponse.json({
      success: true,
      data: { user: sessionUser },
      message: "Login successful",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "An error occurred during login" } },
      { status: 500 }
    );
  }
}
