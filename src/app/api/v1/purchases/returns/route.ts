import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createPurchaseReturnSchema } from "@/lib/schemas/purchase";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "view");

    const returns = await db.purchaseReturn.findMany({
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        warehouse: { select: { id: true, name: true, warehouseCode: true } },
        grn: { select: { id: true, grnNumber: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, materialCode: true, uom: true } },
          },
        },
      },
      orderBy: { returnDate: "desc" },
    });

    return NextResponse.json({ success: true, data: returns });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "create");

    const body = await req.json();
    const parsed = createPurchaseReturnSchema.safeParse(body);
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
      const prNumber = input.prNumber || (await generateNextDocumentNumber("PR"));

      // 1. Create Purchase Return Header
      const pr = await tx.purchaseReturn.create({
        data: {
          prNumber,
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          grnId: input.grnId || null,
          returnDate: input.returnDate ? new Date(input.returnDate) : new Date(),
          reason: input.reason,
          status: "POSTED",
          postedById: actor.id,
          postedAt: new Date(),
          remarks: input.remarks,
        },
      });

      // 2. Validate and deduct stock for each return item
      for (const item of input.items) {
        const qty = new Prisma.Decimal(item.quantity);

        // Check source warehouse available stock
        const sourceBalance = await tx.stockBalance.findFirst({
          where: {
            warehouseId: input.warehouseId,
            siteId: null,
            materialVariantId: item.materialVariantId,
            ownershipType: "OWNED",
            locationType: "WAREHOUSE",
          },
        });

        const available = sourceBalance?.availableQty || new Prisma.Decimal(0);
        if (available.lt(qty)) {
          throw new Error(
            `Insufficient available stock for return at warehouse. Available: ${available.toString()}, Requested return: ${qty.toString()}`
          );
        }

        // Create Item
        await tx.purchaseReturnItem.create({
          data: {
            purchaseReturnId: pr.id,
            materialVariantId: item.materialVariantId,
            quantity: qty,
            unitCost: item.unitCost ? new Prisma.Decimal(item.unitCost) : null,
            reason: item.reason || input.reason,
          },
        });

        // Post Inventory Movement to deduct stock
        await postInventoryMovement(
          {
            materialVariantId: item.materialVariantId,
            quantity: qty.toNumber(),
            uom: "Nos.",
            ownershipType: "OWNED",
            movementType: "SCRAP", // Deducts from source warehouse without destination site
            sourceLocationType: "WAREHOUSE",
            sourceWarehouseId: input.warehouseId,
            destinationLocationType: "SUPPLIER",
            supplierId: input.supplierId,
            referenceDocumentType: "PURCHASE_RETURN",
            referenceDocumentId: pr.id,
            condition: "GOOD",
            notes: `Purchase Return ${prNumber} to supplier: ${input.reason}`,
          },
          actor
        );
      }

      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "PURCHASES",
        entityType: "PurchaseReturn",
        entityId: pr.id,
        notes: `Posted Purchase Return ${prNumber} with ${input.items.length} items. Reason: ${input.reason}`,
      });

      return pr;
    });

    return NextResponse.json({ success: true, data: result, message: `Purchase Return ${result.prNumber} posted.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

