import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { receiveStockTransferSchema } from "@/lib/schemas/stock-transfer";
import { validationErrorResponse } from "@/lib/api-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_transfers", "receive");

    const { id } = await params;
    const body = await req.json();
    const parsed = receiveStockTransferSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const input = parsed.data;

    const stn = await db.stockTransferNote.findUnique({
      where: { id },
      include: {
        items: { include: { materialVariant: true } },
        destinationWarehouse: true,
        sourceWarehouse: true,
      },
    });

    if (!stn) {
      return NextResponse.json(
        { success: false, error: { message: "Stock Transfer Note not found" } },
        { status: 404 }
      );
    }

    if (stn.status !== "DISPATCHED") {
      return NextResponse.json(
        { success: false, error: { message: `STN must be in DISPATCHED state to be received. Current state: ${stn.status}` } },
        { status: 400 }
      );
    }

    const updatedSTN = await db.$transaction(
      async (tx) => {
        // Process each received item
        for (const itemInput of input.items) {
          const itemRecord = stn.items.find((i) => i.id === itemInput.itemId);
          if (!itemRecord) {
            throw new Error(`Item ID ${itemInput.itemId} does not belong to this STN`);
          }

          const receivedQty = Number(itemInput.receivedQty);
          const damagedQty = Number(itemInput.damagedQty || 0);
          const acceptedQty = Math.max(0, receivedQty - damagedQty);
          const transferQty = Number(itemRecord.dispatchedQty);
          const shortageQty = Math.max(0, transferQty - receivedQty);

          // Update item in database
          await tx.stockTransferNoteItem.update({
            where: { id: itemRecord.id },
            data: {
              receivedQty: new Prisma.Decimal(receivedQty),
              damagedQty: new Prisma.Decimal(damagedQty),
              shortageQty: new Prisma.Decimal(shortageQty),
              remarks: itemInput.remarks || itemRecord.remarks,
            },
          });

          // 1. Post good stock into destination warehouse
          if (acceptedQty > 0) {
            await postInventoryMovement(
              {
                materialVariantId: itemRecord.materialVariantId,
                quantity: acceptedQty,
                uom: itemRecord.materialVariant.uom,
                ownershipType: itemRecord.ownershipType as "OWNED" | "HIRED_IN",
                movementType: "INTERNAL_TRANSFER",
                sourceLocationType: "IN_TRANSIT",
                destinationLocationType: "WAREHOUSE",
                destinationWarehouseId: stn.destinationWarehouseId,
                referenceDocumentType: "STOCK_TRANSFER_NOTE",
                referenceDocumentId: stn.id,
                condition: "GOOD",
                notes: `STN Transfer In (Accepted): ${stn.stnNumber} received at ${stn.destinationWarehouse.name}`,
              },
              actor,
              tx
            );
          }

          // 2. Post damaged stock into destination warehouse damaged pool
          if (damagedQty > 0) {
            await postInventoryMovement(
              {
                materialVariantId: itemRecord.materialVariantId,
                quantity: damagedQty,
                uom: itemRecord.materialVariant.uom,
                ownershipType: itemRecord.ownershipType as "OWNED" | "HIRED_IN",
                movementType: "DAMAGE",
                sourceLocationType: "IN_TRANSIT",
                destinationLocationType: "WAREHOUSE",
                destinationWarehouseId: stn.destinationWarehouseId,
                referenceDocumentType: "STOCK_TRANSFER_NOTE",
                referenceDocumentId: stn.id,
                condition: "DAMAGED",
                notes: `STN Transfer Damaged: ${stn.stnNumber} damaged in transit to ${stn.destinationWarehouse.name}`,
              },
              actor,
              tx
            );
          }
        }

        // Mark STN as RECEIVED
        const updated = await tx.stockTransferNote.update({
          where: { id: stn.id },
          data: {
            status: "RECEIVED",
            receivedById: actor.id,
            receivedAt: new Date(),
            notes: (input.notes || input.remarks) ? `${stn.notes ? stn.notes + " | " : ""}${input.notes || input.remarks}` : stn.notes,
          },
          include: {
            items: { include: { materialVariant: true } },
            sourceWarehouse: true,
            destinationWarehouse: true,
          },
        });

        // Audit Log
        await logAuditEvent(
          {
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: "STATUS_CHANGE",
            module: "STOCK_TRANSFER",
            entityType: "StockTransferNote",
            entityId: stn.id,
            ipAddress: actor.ipAddress,
            notes: `Received STN ${stn.stnNumber} at ${stn.destinationWarehouse.name} from ${stn.sourceWarehouse.name}`,
          },
          tx
        );

        return updated;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({ success: true, data: updatedSTN });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

