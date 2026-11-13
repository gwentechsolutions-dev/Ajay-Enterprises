import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, ROLES, MODULES, ACTIONS } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "roles", "view");

    const permissions = await db.rolePermission.findMany({
      orderBy: [{ role: "asc" }, { module: "asc" }, { action: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: {
        roles: ROLES,
        modules: MODULES,
        actions: ACTIONS,
        permissions,
      },
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "roles", "edit");

    const body = await req.json();
    const { role, module, action, isAllowed } = body;

    if (!role || !module || !action || typeof isAllowed !== "boolean") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_BODY", message: "role, module, action, and isAllowed are required" } },
        { status: 400 }
      );
    }

    if (role === "OWNER") {
      return NextResponse.json(
        { success: false, error: { code: "OWNER_IMMUTABLE", message: "Owner permissions cannot be restricted." } },
        { status: 400 }
      );
    }

    const updated = await db.rolePermission.upsert({
      where: {
        role_module_action: {
          role,
          module,
          action,
        },
      },
      update: { isAllowed },
      create: {
        role,
        module,
        action,
        isAllowed,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "ROLES",
      entityType: "RolePermission",
      entityId: updated.id,
      notes: `Updated permission for role ${role}: ${module}.${action} = ${isAllowed}`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Permission updated successfully",
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

