import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { recordStockCountSchema } from "@/lib/schemas/inventory";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    await requirePermission(session, "stock_audit", "edit");

    const { id: stockAuditId } = await params;
    const audit = await db.stockAudit.findUnique({
      where: { id: stockAuditId },
      include: { items: true },
    });

    if (!audit) {
      return NextResponse.json(
        { success: false, error: { message: "Stock audit not found" } },
        { status: 404 }
      );
    }

    if (audit.status === "COMPLETED" || audit.status === "APPROVED") {
      return NextResponse.json(
        { success: false, error: { message: "Cannot edit an already approved or completed stock audit." } },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = recordStockCountSchema.safeParse({ ...body, stockAuditId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Validation failed", details: parsed.error.issues } },
        { status: 422 }
      );
    }

    const { items } = parsed.data;

    await db.$transaction(async (tx) => {
      for (const item of items) {
        const physicalQty = new Prisma.Decimal(item.physicalQty);

        // Find existing item in audit
        const existingItem = await tx.stockAuditItem.findFirst({
          where: {
            stockAuditId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
          },
        });

        if (existingItem) {
          const diff = physicalQty.minus(existingItem.expectedQty);
          await tx.stockAuditItem.update({
            where: { id: existingItem.id },
            data: {
              physicalQty,
              differenceQty: diff,
              condition: item.condition,
              remarks: item.remarks || null,
              photoUrl: item.photoUrl || null,
            },
          });
        } else {
          // If a new item was found on site that was not in expected balance: expected = 0
          const diff = physicalQty;
          await tx.stockAuditItem.create({
            data: {
              stockAuditId,
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              expectedQty: new Prisma.Decimal(0),
              physicalQty,
              differenceQty: diff,
              condition: item.condition,
              remarks: item.remarks || "Item found physically during audit (expected was 0)",
              photoUrl: item.photoUrl || null,
            },
          });
        }
      }

      // Update audit status to PENDING_APPROVAL
      await tx.stockAudit.update({
        where: { id: stockAuditId },
        data: { status: "PENDING_APPROVAL" },
      });
    });

    await logAuditEvent({
      userId: session?.id,
      userName: session?.name,
      userRole: session?.role,
      action: "UPDATE",
      module: "STOCK_AUDIT",
      entityType: "StockAudit",
      entityId: stockAuditId,
      notes: `Recorded physical counts for ${items.length} items in audit ${audit.auditNumber}. Submitted for approval.`,
    });

    return NextResponse.json({
      success: true,
      message: `Physical counts for ${items.length} items recorded successfully. Submitted for approval.`,
    });
  } catch (error: any) {
    const status = error.message.startsWith("UNAUTHORIZED") ? 401 : error.message.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

