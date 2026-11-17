import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { warehouseSchema } from "@/lib/schemas/branch";
import { logAuditEvent } from "@/lib/audit";
import { validationErrorResponse } from "@/lib/api-validation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "warehouses", "view");

    const { id } = await params;
    const warehouse = await db.warehouse.findUnique({
      where: { id },
      include: {
        branch: true,
        users: { select: { id: true, name: true, role: true, userCode: true } },
      },
    });

    if (!warehouse) {
      return NextResponse.json({ success: false, error: { message: "Warehouse not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: warehouse });
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
    await requirePermission(session, "warehouses", "edit");

    const { id } = await params;
    const existing = await db.warehouse.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Warehouse not found" } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = warehouseSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const data = parsed.data;

    if (data.warehouseCode.toUpperCase() !== existing.warehouseCode) {
      const dup = await db.warehouse.findUnique({ where: { warehouseCode: data.warehouseCode.toUpperCase() } });
      if (dup) {
        return NextResponse.json({ success: false, error: { code: "DUPLICATE_CODE", message: "Warehouse code already exists" } }, { status: 409 });
      }
    }

    const updated = await db.warehouse.update({
      where: { id },
      data: {
        warehouseCode: data.warehouseCode.toUpperCase(),
        name: data.name,
        branchId: data.branchId,
        warehouseType: data.warehouseType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        state: data.state,
        pinCode: data.pinCode,
        contactPerson: data.contactPerson,
        mobile: data.mobile,
        gpsLatitude: data.gpsLatitude || null,
        gpsLongitude: data.gpsLongitude || null,
        storageCapacitySqFt: data.storageCapacitySqFt || null,
        isActive: data.isActive,
      },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "WAREHOUSES",
      entityType: "Warehouse",
      entityId: id,
      beforeState: existing,
      afterState: updated,
      notes: `Updated warehouse/yard ${updated.name} (${updated.warehouseCode})`,
    });

    return NextResponse.json({ success: true, data: updated, message: "Warehouse updated successfully" });
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
    await requirePermission(session, "warehouses", "delete");

    const { id } = await params;
    const existing = await db.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Warehouse not found" } }, { status: 404 });
    }

    if (existing._count.users > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WAREHOUSE_IN_USE",
            message: `Cannot delete warehouse with ${existing._count.users} assigned users. Reassign them first.`,
          },
        },
        { status: 400 }
      );
    }

    await db.warehouse.delete({ where: { id } });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "DELETE",
      module: "WAREHOUSES",
      entityType: "Warehouse",
      entityId: id,
      beforeState: existing,
      notes: `Deleted warehouse ${existing.name} (${existing.warehouseCode})`,
    });

    return NextResponse.json({ success: true, message: "Warehouse deleted successfully" });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

