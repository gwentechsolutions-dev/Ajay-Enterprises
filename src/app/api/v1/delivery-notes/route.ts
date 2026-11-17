import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { createDeliveryNoteSchema } from "@/lib/schemas/delivery-note";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const siteId = searchParams.get("customerSiteId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const status = searchParams.get("status") || undefined;

    // Delivery personnel can only see deliveries assigned to them or their warehouse if scoped
    const userScope = session?.scope;
    let assignedFilter: any = {};
    if (session?.role === "DELIVERY_PERSONNEL") {
      assignedFilter = {
        OR: [
          { driverName: { contains: session.name, mode: "insensitive" } },
          { driverPhone: session.mobile || undefined },
          { status: "DISPATCHED" }, // Can see dispatches requiring delivery
        ],
      };
    } else if (userScope === "ASSIGNED_WAREHOUSE" && session?.warehouseId) {
      assignedFilter = { sourceWarehouseId: session.warehouseId };
    }

    const deliveryNotes = await db.deliveryNote.findMany({
      where: {
        customerId,
        customerSiteId: siteId,
        sourceWarehouseId: warehouseId,
        status,
        ...assignedFilter,
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true, fullAddress: true } },
        sourceWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        contactPerson: { select: { id: true, name: true, mobile: true, designation: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
        eWayBills: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { deliveryDate: "desc" },
    });

    return NextResponse.json(
      { success: true, data: deliveryNotes },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
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
    await requirePermission(session, "delivery_notes", "create");

    const body = await req.json();
    const parsed = createDeliveryNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const dnNumber = input.dnNumber || (await generateNextDocumentNumber("DN"));

    const dn = await db.deliveryNote.create({
      data: {
        dnNumber,
        customerId: input.customerId,
        customerSiteId: input.customerSiteId,
        sourceWarehouseId: input.sourceWarehouseId,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : new Date(),
        status: "DRAFT",
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        vehicleNumber: input.vehicleNumber,
        transportMode: input.transportMode || "COMPANY_VEHICLE",
        eWayBillNumber: input.eWayBillNumber,
        contactPersonId: input.contactPersonId || null,
        notes: input.notes,
        items: {
          create: input.items.map((it) => ({
            materialVariantId: it.materialVariantId,
            quantity: new Prisma.Decimal(it.quantity),
            ownershipType: it.ownershipType,
            dailyRate: it.dailyRate ? new Prisma.Decimal(it.dailyRate) : null,
            condition: it.condition,
            remarks: it.remarks,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
        customerSite: true,
      },
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      action: "CREATE",
      module: "DELIVERY_NOTES",
      entityType: "DeliveryNote",
      entityId: dn.id,
      afterState: { dnNumber, customerId: input.customerId, siteId: input.customerSiteId },
      notes: `Created draft Delivery Note ${dnNumber} for site ${dn.customerSite.siteName}`,
    });

    return NextResponse.json({ success: true, data: dn }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

