import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createHiringReturnNoteSchema } from "@/lib/schemas/hiring";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "hiring_notes", "view");

    const searchParams = req.nextUrl.searchParams;
    const supplierId = searchParams.get("supplierId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;

    const hrns = await db.hiringReturnNote.findMany({
      where: {
        supplierId,
        sourceWarehouseId: warehouseId,
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        sourceWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        referenceHdn: { select: { id: true, hdnNumber: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
      },
      orderBy: { returnDate: "desc" },
    });

    return NextResponse.json({ success: true, data: hrns });
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
    const parsed = createHiringReturnNoteSchema.safeParse(body);
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

    const result = await db.$transaction(async (tx) => {
      // 1. Stock availability check in HIRED_IN pool at the warehouse
      for (const item of input.items) {
        const stock = await tx.stockBalance.findFirst({
          where: {
            materialVariantId: item.materialVariantId,
            ownershipType: "HIRED_IN",
            warehouseId: input.sourceWarehouseId,
          },
        });

        const available = stock ? Number(stock.availableQty) : 0;
        if (available < item.quantity) {
          const variant = await tx.materialVariant.findUnique({ where: { id: item.materialVariantId } });
          throw new Error(
            `Insufficient HIRED_IN stock for ${variant?.name || item.materialVariantId}. Required: ${item.quantity}, Available: ${available}`
          );
        }
      }

      const hrnNumber = input.hrnNumber || (await generateNextDocumentNumber("HRN"));

      const hrn = await tx.hiringReturnNote.create({
        data: {
          hrnNumber,
          supplierId: input.supplierId,
          sourceWarehouseId: input.sourceWarehouseId,
          referenceHdnId: input.referenceHdnId || null,
          returnDate: input.returnDate ? new Date(input.returnDate) : new Date(),
          status: "POSTED",
          postedById: actor.id,
          postedAt: new Date(),
          notes: input.notes,
          items: {
            create: input.items.map((item) => ({
              materialVariantId: item.materialVariantId,
              quantity: new Prisma.Decimal(item.quantity),
              condition: item.condition,
              remarks: item.remarks,
            })),
          },
        },
        include: {
          items: { include: { materialVariant: true } },
          supplier: true,
          sourceWarehouse: true,
        },
      });

      // Deduct from HIRED_IN stock pool at warehouse
      for (const item of input.items) {
        await postInventoryMovement(
          {
            materialVariantId: item.materialVariantId,
            quantity: item.quantity,
            uom: "Nos.",
            ownershipType: "HIRED_IN",
            movementType: "SCRAP", // Deducts available stock from warehouse without destination site
            sourceLocationType: "WAREHOUSE",
            sourceWarehouseId: input.sourceWarehouseId,
            destinationLocationType: "SUPPLIER",
            supplierId: input.supplierId,
            referenceDocumentType: "HIRING_RETURN_NOTE",
            referenceDocumentId: hrn.id,
            condition: (item.condition as "GOOD" | "FAIR" | "DAMAGED") || "GOOD",
            notes: `Hired material returned to ${hrn.supplier.name} under ${hrn.hrnNumber}`,
          },
          actor
        );
      }

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "CREATE",
        module: "HIRING_NOTE",
        entityType: "HiringReturnNote",
        entityId: hrn.id,
        ipAddress: actor.ipAddress,
        notes: `Posted Hiring Return Note ${hrn.hrnNumber} returning materials to ${hrn.supplier.name}`,
      });

      return hrn;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

