import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createGoodsReceiptNoteSchema } from "@/lib/schemas/purchase";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "purchases", "view");

    const searchParams = req.nextUrl.searchParams;
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const poId = searchParams.get("purchaseOrderId") || undefined;

    const grns = await db.goodsReceiptNote.findMany({
      where: {
        receivingWarehouseId: warehouseId,
        supplierId,
        purchaseOrderId: poId,
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        receivingWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
      },
      orderBy: { receiptDate: "desc" },
    });

    return NextResponse.json({ success: true, data: grns });
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
    const parsed = createGoodsReceiptNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress,
    };

    // Execute atomic GRN creation, stock balance update, and PO progress update
    const result = await db.$transaction(async (tx) => {
      const grnNumber = input.grnNumber || (await generateNextDocumentNumber("GRN"));

      // 1. If PO is linked, validate PO exists and is approved
      let poRecord = null;
      if (input.purchaseOrderId) {
        poRecord = await tx.purchaseOrder.findUnique({
          where: { id: input.purchaseOrderId },
          include: { items: true },
        });

        if (!poRecord) {
          throw new Error(`Linked Purchase Order '${input.purchaseOrderId}' not found.`);
        }

        if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(poRecord.status)) {
          throw new Error(`Cannot receive against Purchase Order in '${poRecord.status}' status. PO must be APPROVED.`);
        }
      }

      // 2. Create GRN Header
      const grn = await tx.goodsReceiptNote.create({
        data: {
          grnNumber,
          purchaseOrderId: input.purchaseOrderId || null,
          supplierId: input.supplierId,
          receivingWarehouseId: input.receivingWarehouseId,
          receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          supplierInvoiceDate: input.supplierInvoiceDate ? new Date(input.supplierInvoiceDate) : null,
          status: "POSTED",
          remarks: input.remarks,
          postedById: actor.id,
          postedAt: new Date(),
        },
      });

      // 3. Process each GRN line item
      for (const item of input.items) {
        const receivedQty = new Prisma.Decimal(item.receivedQty);
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const damagedQty = new Prisma.Decimal(item.damagedQty || 0);
        const rejectedQty = new Prisma.Decimal(item.rejectedQty || 0);

        if (acceptedQty.plus(damagedQty).plus(rejectedQty).gt(receivedQty)) {
          throw new Error(
            `Sum of accepted (${acceptedQty}), damaged (${damagedQty}), and rejected (${rejectedQty}) cannot exceed received quantity (${receivedQty}).`
          );
        }

        // Create GRN item
        await tx.goodsReceiptNoteItem.create({
          data: {
            grnId: grn.id,
            materialVariantId: item.materialVariantId,
            poItemId: item.poItemId || null,
            orderedQty: new Prisma.Decimal(item.orderedQty || 0),
            receivedQty,
            acceptedQty,
            rejectedQty,
            damagedQty,
            unitCost: item.unitCost ? new Prisma.Decimal(item.unitCost) : null,
            condition: item.condition,
            remarks: item.remarks,
          },
        });

        // Post Inventory Movement for Accepted Stock (Good condition)
        if (acceptedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: acceptedQty.toNumber(),
              uom: "Nos.",
              ownershipType: "OWNED",
              movementType: "STOCK_RECEIPT",
              sourceLocationType: "SUPPLIER",
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: input.receivingWarehouseId,
              supplierId: input.supplierId,
              referenceDocumentType: "GRN",
              referenceDocumentId: grn.id,
              condition: "GOOD",
              unitCost: item.unitCost,
              notes: `GRN ${grnNumber} receipt: Accepted ${acceptedQty.toString()} units.`,
            },
            actor
          );
        }

        // Post Inventory Movement for Damaged Stock (Routed to damaged pool)
        if (damagedQty.gt(0)) {
          await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: damagedQty.toNumber(),
              uom: "Nos.",
              ownershipType: "OWNED",
              movementType: "STOCK_RECEIPT",
              sourceLocationType: "SUPPLIER",
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: input.receivingWarehouseId,
              supplierId: input.supplierId,
              referenceDocumentType: "GRN",
              referenceDocumentId: grn.id,
              condition: "DAMAGED",
              unitCost: item.unitCost,
              notes: `GRN ${grnNumber} receipt: Damaged on arrival ${damagedQty.toString()} units.`,
            },
            actor
          );
        }

        // Update PO Item progress if linked
        if (item.poItemId) {
          const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.poItemId } });
          if (poItem) {
            const newRecQty = poItem.receivedQty.plus(acceptedQty);
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { receivedQty: newRecQty },
            });
          }
        }
      }

      // 4. Update overall PO status if linked
      if (input.purchaseOrderId) {
        const allPoItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: input.purchaseOrderId },
        });

        const isFullyReceived = allPoItems.every((it) => it.receivedQty.gte(it.quantity));
        const hasSomeReceived = allPoItems.some((it) => it.receivedQty.gt(0));

        await tx.purchaseOrder.update({
          where: { id: input.purchaseOrderId },
          data: {
            status: isFullyReceived ? "COMPLETED" : hasSomeReceived ? "PARTIALLY_RECEIVED" : "APPROVED",
          },
        });
      }

      // 5. Audit Logging
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        ipAddress: actor.ipAddress,
        action: "POST",
        module: "PURCHASES",
        entityType: "GoodsReceiptNote",
        entityId: grn.id,
        notes: `Posted GRN ${grnNumber} with ${input.items.length} material lines.`,
      });

      return grn;
    });

    // Notify supplier via WhatsApp (non-blocking)
    const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
    if (supplier?.primaryMobile) {
      sendWhatsAppNotification({
        recipientMobile: supplier.primaryMobile,
        recipientName: supplier.name,
        templateName: "GRN_COMPLETED",
        documentNumber: result.grnNumber,
        documentType: "GoodsReceiptNote",
        parameters: {
          grnNumber: result.grnNumber,
          date: result.receiptDate.toLocaleDateString(),
        },
      });
    }

    return NextResponse.json({ success: true, data: result, message: `GRN ${result.grnNumber} posted successfully.` }, { status: 201 });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

