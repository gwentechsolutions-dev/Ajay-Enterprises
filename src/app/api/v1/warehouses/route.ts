import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { warehouseSchema } from "@/lib/schemas/branch";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    await requirePermission(session, "warehouses", "view");

    const warehouses = await db.warehouse.findMany({
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { success: true, data: warehouses },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "warehouses", "create");

    const body = await req.json();
    const parsed = warehouseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // Check duplicate code
    const existing = await db.warehouse.findUnique({
      where: { warehouseCode: data.warehouseCode.toUpperCase() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_CODE", message: "Warehouse code already exists" } },
        { status: 409 }
      );
    }

    const newWarehouse = await db.warehouse.create({
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
      action: "CREATE",
      module: "WAREHOUSES",
      entityType: "Warehouse",
      entityId: newWarehouse.id,
      afterState: newWarehouse,
      notes: `Created warehouse/yard ${newWarehouse.name} (${newWarehouse.warehouseCode}) under branch ${newWarehouse.branch.name}`,
    });

    return NextResponse.json({ success: true, data: newWarehouse, message: "Warehouse created successfully" }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

