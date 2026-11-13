import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_transfers", "dispatch");

    const { id } = await params;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const stn = await db.stockTransferNote.findUnique({
      where: { id },
      include: {
        items: { include: { materialVariant: true } },
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
    });

    if (!stn) {
      return NextResponse.json(
        { success: false, error: { message: "Stock Transfer Note not found" } },
        { status: 404 }
      );
    }

    if (stn.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: { message: `STN is already ${stn.status} and cannot be dispatched` } },
        { status: 400 }
      );
    }

    const updatedSTN = await db.$transaction(async (tx) => {
      // 1. Stock availability validation for each line item at source warehouse
      for (const item of stn.items) {
        const requiredQty = Number(item.dispatchedQty);
        const stockBalance = await tx.stockBalance.findFirst({
          where: {
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            warehouseId: stn.sourceWarehouseId,
          },
        });

        const available = stockBalance ? Number(stockBalance.availableQty) : 0;
        if (available < requiredQty) {
          throw new Error(
            `Insufficient stock for ${item.materialVariant.name} (${item.materialVariant.materialCode}) in pool ${item.ownershipType} at ${stn.sourceWarehouse.name}. Required: ${requiredQty}, Available: ${available}`
          );
        }
      }

      // 2. Post inventory movements deducting source warehouse
      for (const item of stn.items) {
        const qty = Number(item.dispatchedQty);

        await postInventoryMovement(
          {
            materialVariantId: item.materialVariantId,
            quantity: qty,
            uom: item.materialVariant.uom,
            ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
            movementType: "INTERNAL_TRANSFER",
            sourceLocationType: "WAREHOUSE",
            sourceWarehouseId: stn.sourceWarehouseId,
            destinationLocationType: "IN_TRANSIT",
            referenceDocumentType: "STOCK_TRANSFER_NOTE",
            referenceDocumentId: stn.id,
            condition: "GOOD",
            notes: `STN Transfer Out: ${stn.stnNumber} dispatched to ${stn.destinationWarehouse.name}`,
          },
          actor
        );
      }

      // 3. Update STN status to DISPATCHED
      const updated = await tx.stockTransferNote.update({
        where: { id: stn.id },
        data: {
          status: "DISPATCHED",
          dispatchedById: actor.id,
          dispatchedAt: new Date(),
        },
        include: {
          items: { include: { materialVariant: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });

      // 4. Audit Log
      await logAuditEvent({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "STATUS_CHANGE",
        module: "STOCK_TRANSFER",
        entityType: "StockTransferNote",
        entityId: stn.id,
        ipAddress: actor.ipAddress,
        notes: `Dispatched STN ${stn.stnNumber} from ${stn.sourceWarehouse.name} to ${stn.destinationWarehouse.name} (in transit)`,
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedSTN });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

