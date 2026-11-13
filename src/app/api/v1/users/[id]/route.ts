import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { updateUserSchema } from "@/lib/schemas/user";
import { logAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "users", "view");

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        supabaseId: true,
        userCode: true,
        name: true,
        email: true,
        username: true,
        mobile: true,
        role: true,
        scope: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        branchId: true,
        warehouseId: true,
        branch: { select: { id: true, name: true, branchCode: true } },
        warehouse: { select: { id: true, name: true, warehouseCode: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "users", "edit");

    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Safeguard: Prevent removing or deactivating the last active OWNER
    if (existing.role === "OWNER" && (data.role !== "OWNER" || !data.isActive)) {
      const activeOwnerCount = await db.user.count({
        where: { role: "OWNER", isActive: true },
      });
      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "LAST_OWNER_PROTECTION",
              message: "Cannot demote or deactivate the last active Owner account. Promote another user first.",
            },
          },
          { status: 400 }
        );
      }
    }

    // Check duplicate email
    if (data.email.toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
      if (dup) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_EMAIL", message: "Email is already in use by another user" } },
          { status: 409 }
        );
      }
    }

    // Check duplicate username
    if (data.username && data.username !== existing.username) {
      const dup = await db.user.findUnique({ where: { username: data.username } });
      if (dup) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_USERNAME", message: "Username is already in use" } },
          { status: 409 }
        );
      }
    }

    // Update credentials in Supabase Auth if configured and provided
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    if (isSupabaseConfigured && existing.supabaseId) {
      const supabaseAdmin = createAdminClient();
      const authUpdates: any = {};
      if (data.email.toLowerCase() !== existing.email.toLowerCase()) {
        authUpdates.email = data.email.toLowerCase().trim();
      }
      if (data.password && data.password.trim().length >= 8) {
        authUpdates.password = data.password.trim();
      }
      if (Object.keys(authUpdates).length > 0) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          existing.supabaseId,
          authUpdates
        );
        if (authErr) {
          return NextResponse.json(
            { success: false, error: { code: "SUPABASE_AUTH_ERROR", message: authErr.message } },
            { status: 400 }
          );
        }
      }
    }

    const updatePayload: any = {
      name: data.name,
      email: data.email.toLowerCase().trim(),
      username: data.username ? data.username.trim() : null,
      mobile: data.mobile.trim(),
      role: data.role,
      scope: data.scope,
      branchId: data.branchId || null,
      warehouseId: data.warehouseId || null,
      isActive: data.isActive,
    };

    const updatedUser = await db.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        supabaseId: true,
        userCode: true,
        name: true,
        email: true,
        username: true,
        mobile: true,
        role: true,
        scope: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "USERS",
      entityType: "User",
      entityId: updatedUser.id,
      beforeState: existing,
      afterState: updatedUser,
      notes: `Updated user profile for ${updatedUser.name} (${updatedUser.userCode})`,
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: "User updated successfully",
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "users", "delete");

    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Protect last active owner
    if (existing.role === "OWNER") {
      const activeOwnerCount = await db.user.count({
        where: { role: "OWNER", isActive: true },
      });
      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "LAST_OWNER_PROTECTION",
              message: "Cannot deactivate or delete the last active Owner account.",
            },
          },
          { status: 400 }
        );
      }
    }

    // Soft deactivate user
    const deactivated = await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Also disable in Supabase Auth if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes("placeholder");

    if (isSupabaseConfigured && existing.supabaseId) {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.updateUserById(existing.supabaseId, {
        ban_duration: "876000h", // 100 years
      });
    }

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DEACTIVATE",
      module: "USERS",
      entityType: "User",
      entityId: id,
      notes: `Deactivated user ${existing.name} (${existing.userCode})`,
    });

    return NextResponse.json({
      success: true,
      message: "User deactivated successfully",
      data: deactivated,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
