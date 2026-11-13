import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_audit", "approve");

    const { id: stockAuditId } = await params;
    const audit = await db.stockAudit.findUnique({
      where: { id: stockAuditId },
      include: {
        warehouse: true,
        items: { include: { materialVariant: true } },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { success: false, error: { message: "Stock audit not found" } },
        { status: 404 }
      );
    }

    if (audit.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: { message: "This stock audit has already been reconciled and completed." } },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress,
    };

    let adjustmentsCount = 0;

    for (const item of audit.items) {
      const diff = Number(item.differenceQty);

      // Only items with differences require reconciliation movements
      if (diff !== 0 && item.adjustmentStatus !== "ADJUSTED") {
        if (diff > 0) {
          // Excess stock found physically
          const movementRes = await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: diff,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType as any,
              movementType: "FOUND_STOCK",
              sourceLocationType: "NONE",
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: audit.warehouseId,
              referenceDocumentType: "AUDIT_RECONCILIATION",
              referenceDocumentId: audit.id,
              condition: item.condition as any,
              notes: `Physical Stock Audit Reconciliation [${audit.auditNumber}]: Excess verified (+${diff}). Counted: ${item.physicalQty}, Expected: ${item.expectedQty}`,
            },
            actor
          );

          await db.stockAuditItem.update({
            where: { id: item.id },
            data: {
              adjustmentStatus: "ADJUSTED",
              adjustmentMovementId: movementRes.movementId,
            },
          });
          adjustmentsCount++;
        } else if (diff < 0) {
          // Shortage / missing stock physically
          const shortageQty = Math.abs(diff);
          const movementRes = await postInventoryMovement(
            {
              materialVariantId: item.materialVariantId,
              quantity: shortageQty,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType as any,
              movementType: "MISSING",
              sourceLocationType: "WAREHOUSE",
              sourceWarehouseId: audit.warehouseId,
              destinationLocationType: "MISSING",
              referenceDocumentType: "AUDIT_RECONCILIATION",
              referenceDocumentId: audit.id,
              condition: item.condition as any,
              notes: `Physical Stock Audit Reconciliation [${audit.auditNumber}]: Shortage verified (-${shortageQty}). Counted: ${item.physicalQty}, Expected: ${item.expectedQty}`,
            },
            actor
          );

          await db.stockAuditItem.update({
            where: { id: item.id },
            data: {
              adjustmentStatus: "ADJUSTED",
              adjustmentMovementId: movementRes.movementId,
            },
          });
          adjustmentsCount++;
        }
      }
    }

    // Complete the audit
    const updatedAudit = await db.stockAudit.update({
      where: { id: stockAuditId },
      data: {
        status: "COMPLETED",
        approvedById: session!.id,
        approvedAt: new Date(),
      },
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "APPROVE",
      module: "STOCK_AUDIT",
      entityType: "StockAudit",
      entityId: stockAuditId,
      notes: `Approved stock audit ${audit.auditNumber} for warehouse ${audit.warehouse.name}. Generated ${adjustmentsCount} reconciliation ledger movements.`,
    });

    return NextResponse.json({
      success: true,
      message: `Stock audit ${audit.auditNumber} approved and completed. ${adjustmentsCount} stock adjustments posted to ledger.`,
      data: updatedAudit,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
