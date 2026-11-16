import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createHiringDeliveryNoteSchema } from "@/lib/schemas/hiring";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "hiring_notes", "view");

    const searchParams = req.nextUrl.searchParams;
    const supplierId = searchParams.get("supplierId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const hdns = await db.hiringDeliveryNote.findMany({
      where: {
        supplierId,
        receivingWarehouseId: warehouseId,
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        receivingWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
      },
      orderBy: { receiptDate: "desc" },
    });

    return NextResponse.json({ success: true, data: hdns });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "hiring_notes", "create");

    const body = await req.json();
    const parsed = createHiringDeliveryNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const result = await db.$transaction(
      async (tx) => {
        const hdnNumber = input.hdnNumber || (await generateNextDocumentNumber("HDN", undefined, tx));

        const hdn = await tx.hiringDeliveryNote.create({
          data: {
            hdnNumber,
            supplierId: input.supplierId,
            receivingWarehouseId: input.receivingWarehouseId,
            receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
            supplierReference: input.supplierReference,
            effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : new Date(),
            status: "POSTED",
            postedById: actor.id,
            postedAt: new Date(),
            notes: input.notes,
            items: {
              create: input.items.map((item) => ({
                materialVariantId: item.materialVariantId,
                quantity: new Prisma.Decimal(item.quantity),
                dailyHiringRate: new Prisma.Decimal(item.dailyHiringRate),
                condition: item.condition,
                remarks: item.remarks,
              })),
            },
          },
          include: {
            items: { include: { materialVariant: true } },
            supplier: true,
            receivingWarehouse: true,
          },
        });

        // Update inventory movement ledger and StockBalance for HIRED_IN pool
        for (const item of input.items) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: item.quantity,
              uom: "Nos.",
              ownershipType: "HIRED_IN",
              movementType: "STOCK_RECEIPT",
              sourceLocationType: "SUPPLIER",
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: input.receivingWarehouseId,
              supplierId: input.supplierId,
              referenceDocumentType: "HIRING_DELIVERY_NOTE",
              referenceDocumentId: hdn.id,
              condition: (item.condition as "GOOD" | "FAIR" | "DAMAGED") || "GOOD",
              notes: `Hired material received from ${hdn.supplier.name} under ${hdn.hdnNumber}`,
            },
            actor,
            tx
          );
        }

        await logAuditEvent(
          {
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: "CREATE",
            module: "HIRING_NOTE",
            entityType: "HiringDeliveryNote",
            entityId: hdn.id,
            ipAddress: actor.ipAddress,
            notes: `Posted Hiring Delivery Note ${hdn.hdnNumber} from ${hdn.supplier.name} to ${hdn.receivingWarehouse.name}`,
          },
          tx
        );

        return hdn;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

