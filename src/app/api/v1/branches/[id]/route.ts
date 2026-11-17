import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { branchSchema } from "@/lib/schemas/branch";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "branches", "view");

    const { id } = await params;
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        warehouses: true,
        users: { select: { id: true, name: true, role: true, userCode: true } },
      },
    });

    if (!branch) {
      return NextResponse.json({ success: false, error: { message: "Branch not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: branch });
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
    await requirePermission(session, "branches", "edit");

    const { id } = await params;
    const existing = await db.branch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Branch not found" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;

    if (data.branchCode.toUpperCase() !== existing.branchCode) {
      const dup = await db.branch.findUnique({ where: { branchCode: data.branchCode.toUpperCase() } });
      if (dup) {
        return NextResponse.json({ success: false, error: { code: "DUPLICATE_CODE", message: "Branch code already exists" } }, { status: 409 });
      }
    }

    const updated = await db.branch.update({
      where: { id },
      data: {
        branchCode: data.branchCode.toUpperCase(),
        name: data.name,
        branchType: data.branchType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        email: data.email || null,
        isActive: data.isActive,
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "BRANCHES",
      entityType: "Branch",
      entityId: id,
      beforeState: existing,
      afterState: updated,
      notes: `Updated branch ${updated.name} (${updated.branchCode})`,
    });

    return NextResponse.json({ success: true, data: updated, message: "Branch updated successfully" });
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
    await requirePermission(session, "branches", "delete");

    const { id } = await params;
    const existing = await db.branch.findUnique({
      where: { id },
      include: { _count: { select: { warehouses: true, users: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Branch not found" } }, { status: 404 });
    }

    if (existing._count.warehouses > 0 || existing._count.users > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRANCH_IN_USE",
            message: `Cannot delete branch with ${existing._count.warehouses} attached warehouses or ${existing._count.users} attached users. Reassign them first.`,
          },
        },
        { status: 400 }
      );
    }

    await db.branch.delete({ where: { id } });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DELETE",
      module: "BRANCHES",
      entityType: "Branch",
      entityId: id,
      beforeState: existing,
      notes: `Deleted branch ${existing.name} (${existing.branchCode})`,
    });

    return NextResponse.json({ success: true, message: "Branch deleted successfully" });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

