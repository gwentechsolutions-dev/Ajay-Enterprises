import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "view");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: true,
        customerSite: true,
        sourceWarehouse: true,
        contactPerson: true,
        items: {
          include: {
            materialVariant: true,
          },
        },
        evidences: true,
        eWayBills: true,
        returnNotes: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: dn });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "edit");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    if (dn.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: { message: `Cannot modify a Delivery Note in ${dn.status} status. Only DRAFT delivery notes can be edited.` } },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      sourceWarehouseId,
      customerId,
      customerSiteId,
      deliveryDate,
      vehicleNumber,
      driverName,
      driverPhone,
      notes,
      includeDeliveryDate,
      transportCharges,
      items,
    } = body;

    const updated = await db.$transaction(async (tx) => {
      // If items are provided, replace them
      if (Array.isArray(items) && items.length > 0) {
        await tx.deliveryNoteItem.deleteMany({
          where: { deliveryNoteId: id },
        });

        await tx.deliveryNoteItem.createMany({
          data: items.map((it: any) => ({
            deliveryNoteId: id,
            materialVariantId: it.materialVariantId,
            quantity: new Prisma.Decimal(it.quantity || it.dispatchedQty),
            ownershipType: it.ownershipType || "OWNED",
            dailyRate: it.dailyRate || it.dailyRentalRate ? new Prisma.Decimal(it.dailyRate || it.dailyRentalRate) : null,
            condition: it.condition || "GOOD",
            remarks: it.remarks || null,
          })),
        });
      }

      const result = await tx.deliveryNote.update({
        where: { id },
        data: {
          ...(sourceWarehouseId ? { sourceWarehouseId } : {}),
          ...(customerId ? { customerId } : {}),
          ...(customerSiteId ? { customerSiteId } : {}),
          ...(deliveryDate ? { deliveryDate: new Date(deliveryDate) } : {}),
          ...(vehicleNumber !== undefined ? { vehicleNumber } : {}),
          ...(driverName !== undefined ? { driverName } : {}),
          ...(driverPhone !== undefined ? { driverPhone } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(includeDeliveryDate !== undefined ? { includeDeliveryDate } : {}),
          ...(transportCharges !== undefined
            ? { transportCharges: transportCharges ? new Prisma.Decimal(transportCharges) : new Prisma.Decimal(0) }
            : {}),
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          customerSite: { select: { id: true, siteName: true, siteCode: true, fullAddress: true } },
          sourceWarehouse: { select: { id: true, name: true, warehouseCode: true } },
          items: {
            include: {
              materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
            },
          },
        },
      });

      return result;
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "UPDATE",
      module: "DELIVERY_NOTES",
      entityType: "DeliveryNote",
      entityId: dn.id,
      notes: `Updated draft delivery note ${dn.dnNumber}.`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    await requirePermission(session, "delivery_notes", "delete");
    const { id } = await params;

    const dn = await db.deliveryNote.findUnique({
      where: { id },
    });

    if (!dn) {
      return NextResponse.json({ success: false, error: { message: "Delivery Note not found" } }, { status: 404 });
    }

    if (dn.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: { message: `Cannot delete Delivery Note ${dn.dnNumber} in ${dn.status} status. Only DRAFT delivery notes can be discarded.` } },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: id } });
      await tx.deliveryNote.delete({ where: { id } });
    });

    await logAuditEvent({
      userId: session!.id,
      userName: session!.name,
      userRole: session!.role,
      action: "DELETE",
      module: "DELIVERY_NOTES",
      entityType: "DeliveryNote",
      entityId: dn.id,
      notes: `Discarded draft delivery note ${dn.dnNumber}.`,
    });

    return NextResponse.json({ success: true, message: `Draft Delivery Note ${dn.dnNumber} discarded.` });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}


